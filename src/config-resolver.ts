import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { ChatConfig, ChatConfigSchema } from './types.js';

export interface ConfigInfo {
  name: string;
  path: string;
  source: 'local' | 'global';
  exists: boolean;
}

/**
 * Get XDG config directory or fallback to ~/.config
 */
function getConfigHome(): string {
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
}

/**
 * Get the global config directory
 */
function getGlobalConfigDir(): string {
  return join(getConfigHome(), 'theater-chat');
}

/**
 * Get the local config directory for current working directory
 */
function getLocalConfigDir(): string {
  return join(process.cwd(), '.theater-chat');
}

/**
 * Get all available configs (local and global)
 */
export function listConfigs(): ConfigInfo[] {
  const localDir = getLocalConfigDir();
  const globalDir = getGlobalConfigDir();
  const allConfigs: ConfigInfo[] = [];

  // Scan local and global directories
  if (existsSync(localDir)) {
    scanDirectory(localDir, '', 'local', allConfigs);
  }
  if (existsSync(globalDir)) {
    scanDirectory(globalDir, '', 'global', allConfigs);
  }

  // Deduplicate, giving precedence to local configs
  const uniqueConfigs = new Map<string, ConfigInfo>();
  for (const config of allConfigs) {
    if (!uniqueConfigs.has(config.name)) {
      uniqueConfigs.set(config.name, config);
    }
  }

  return Array.from(uniqueConfigs.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively scan directory for JSON configs and add them to a list
 */
function scanDirectory(dir: string, prefix: string, source: 'local' | 'global', configs: ConfigInfo[]) {
  if (!existsSync(dir)) return;

  try {
    const items = readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      // Skip items with undefined names (corrupted file system entries)
      if (!item.name) {
        continue;
      }
      
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        const subPrefix = prefix ? `${prefix}/${item.name}` : item.name;
        scanDirectory(fullPath, subPrefix, source, configs);
      } else if (item.name.endsWith('.json')) {
        const configName = prefix
          ? `${prefix}/${item.name.replace('.json', '')}`
          : item.name.replace('.json', '');

        configs.push({
          name: configName,
          path: fullPath,
          source: source,
          exists: true
        });
      }
    }
  } catch (error) {
    // Log errors instead of ignoring them
    console.error(chalk.yellow(`⚠ Could not scan directory ${dir}: ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * Initialize config directories with default configs
 */
export function initConfigs(target: 'local' | 'global' | 'both' = 'local'): void {
  const defaultSonnetConfig = {
    actor: {
      manifest_path: "/Users/colinrozzi/work/actor-registry/chat-state-proxy/manifest.toml",
      initial_state: {
        config: {
          model_config: {
            model: "claude-sonnet-4-20250514",
            provider: "anthropic"
          },
          temperature: 1,
          max_tokens: 8192,
          system_prompt: "You are a helpful programming assistant.",
          title: "Sonnet Chat",
          mcp_servers: []
        }
      }
    }
  };

  if (target === 'local' || target === 'both') {
    const localDir = getLocalConfigDir();
    mkdirSync(localDir, { recursive: true });

    const sonnetPath = join(localDir, 'sonnet.json');
    if (!existsSync(sonnetPath)) {
      writeFileSync(sonnetPath, JSON.stringify(defaultSonnetConfig, null, 2));
      console.log(chalk.green(`✓ Created local config: ${sonnetPath}`));
    } else {
      console.log(chalk.yellow(`⚠ Local config already exists: ${sonnetPath}`));
    }
  }

  if (target === 'global' || target === 'both') {
    const globalDir = getGlobalConfigDir();
    mkdirSync(globalDir, { recursive: true });

    const sonnetPath = join(globalDir, 'sonnet.json');
    if (!existsSync(sonnetPath)) {
      writeFileSync(sonnetPath, JSON.stringify(defaultSonnetConfig, null, 2));
      console.log(chalk.green(`✓ Created global config: ${sonnetPath}`));
    } else {
      console.log(chalk.yellow(`⚠ Global config already exists: ${sonnetPath}`));
    }
  }
}

/**
 * Get the saved chats directory (local only)
 */
function getSavedChatsDir(): string {
  return join(getLocalConfigDir(), 'saved');
}

/**
 * Generate a timestamp-based filename for saving chats
 */
function generateTimestampFilename(): string {
  const now = new Date();
  const month = (now.getMonth() + 1).toString();
  const day = now.getDate().toString();
  const year = now.getFullYear().toString().slice(-2);
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');

  return `${month}-${day}-${year}-${hour}${minute}`;
}

/**
 * Save chat metadata to a timestamped file
 */
export function autoSaveChatSession(chatMetadata: any): string {
  const savedDir = getSavedChatsDir();
  mkdirSync(savedDir, { recursive: true });

  const filename = generateTimestampFilename();
  const savedPath = join(savedDir, `${filename}.json`);

  writeFileSync(savedPath, JSON.stringify(chatMetadata, null, 2));
  console.log(chalk.green(`   Chat saved at: saved/${filename}`));

  return filename;
}


export interface ResolvedConfig {
  config: ChatConfig;
  source: 'local' | 'global';
  path: string;
}

// Example function
export function resolveConfigPath(configName: string): ResolvedConfig | null {
  const localDir = getLocalConfigDir();
  const globalDir = getGlobalConfigDir();
  const fileName = configName.endsWith('.json') ? configName : `${configName}.json`;

  const tryLoad = (dir: string, source: 'local' | 'global'): ResolvedConfig | null => {
    const fullPath = join(dir, fileName);
    if (!existsSync(fullPath)) return null;
    try {
      const parsed = JSON.parse(readFileSync(fullPath, 'utf8'));
      const config = ChatConfigSchema.parse(parsed);
      return { config, source, path: fullPath };
    } catch (err) {
      console.error(chalk.red(`Invalid config at ${fullPath}: ${err}`));
      return null;
    }
  };


  let result = tryLoad(localDir, 'local') || tryLoad(globalDir, 'global');

  return result;
}

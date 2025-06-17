#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TheaterClient } from './theater.js';
import { renderApp } from './ui.js';
import type {
  ChatConfig,
  TheaterChatConfig,
  CLIOptions,
  ConfigListOptions,
  ConfigInitOptions
} from './types.js';

// Set up logging
const logFile = path.join(process.cwd(), 'theater-chat.log');
function log(message: string, level: string = 'INFO'): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
}

// Clear log file on start
fs.writeFileSync(logFile, `=== theater-chat started at ${new Date().toISOString()} ===\n`);
log('Application started');

program
  .name('theater-chat')
  .description('Configurable inline chat interface for Theater actors')
  .option('-c, --config <path>', 'Path to chat configuration JSON file', 'default')
  .option('-s, --server <address>', 'Theater server address', '127.0.0.1:9000')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-m, --message <text>', 'Send an initial message to start the conversation')
  .action(main); // Default action when no subcommand is provided

// Config management commands
program
  .command('list')
  .alias('ls')
  .description('List available configurations (defaults to local)')
  .option('-g, --global', 'Show only global configurations')
  .option('-a, --all', 'Show both local and global configurations')
  .action(listConfigs);

program
  .command('init')
  .description('Initialize local configuration directory')
  .option('-g, --global', 'Initialize global config directory instead')
  .action(initConfigs);

program.parse();

function getConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'theater-chat');
  }
  return path.join(os.homedir(), '.config', 'theater-chat');
}

function createDefaultConfigs(configDir: string): void {
  // Create the config directory
  fs.mkdirSync(configDir, { recursive: true });

  // Default config - Claude Sonnet 4
  const defaultConfig: TheaterChatConfig = {
    actor: {
      manifest_path: "/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml"
    },
    config: {
    model_config: {
      model: "claude-sonnet-4-20250514",
      provider: "anthropic"
    },
    temperature: 1.0,
    max_tokens: 8192,
    system_prompt: "You are a helpful assistant.",
    title: "Theater Chat",
    mcp_servers: []
    }
  };

  // Sonnet base config
  const sonnetConfig: TheaterChatConfig = {
    actor: {
      manifest_path: "/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml"
    },
    config: {
    model_config: {
      model: "claude-sonnet-4-20250514",
      provider: "anthropic"
    },
    temperature: 1.0,
    max_tokens: 8192,
    system_prompt: "You are a helpful programming assistant.",
    title: "Sonnet Assistant",
    mcp_servers: []
    }
  };

  // Create sonnet directory and specialized configs
  const sonnetDir = path.join(configDir, 'sonnet');
  fs.mkdirSync(sonnetDir, { recursive: true });

  const sonnetGitConfig: TheaterChatConfig = {
    actor: {
      manifest_path: "/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml"
    },
    config: {
      model_config: {
        model: "claude-sonnet-4-20250514",
        provider: "anthropic"
      },
      temperature: 1.0,
      max_tokens: 8192,
      system_prompt: "You are a helpful programming assistant with git access. You can help with version control, reviewing changes, and managing repositories.",
      title: "Sonnet + Git",
      mcp_servers: [
        {
          "actor_id": null,
          "actor": {
            "manifest_path": "/Users/colinrozzi/work/actor-registry/git-mcp-actor/manifest.toml"
          },
          "tools": null
        }
      ]
    }
  };

  const sonnetFsConfig: TheaterChatConfig = {
    actor: {
      manifest_path: "/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml"
    },
    config: {
      model_config: {
        model: "claude-sonnet-4-20250514",
        provider: "anthropic"
      },
      temperature: 1.0,
      max_tokens: 8192,
      system_prompt: "You are a helpful programming assistant with filesystem access. You can read, write, and analyze files in the current project.",
      title: "Sonnet + Filesystem",
      mcp_servers: [
        {
          "actor_id": null,
          "stdio": {
            "command": "/path/to/fs-mcp-server",
            "args": ["--allowed-dirs", "."]
          },
          "tools": null
        }
      ]
    }
  };

  // Gemini configs
  const geminiDir = path.join(configDir, 'gemini');
  fs.mkdirSync(geminiDir, { recursive: true });

  const geminiConfig: TheaterChatConfig = {
    actor: {
      manifest_path: "/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml"
    },
    config: {
      model_config: {
        model: "gemini-1.5-pro",
        provider: "google"
      },
      temperature: 1.0,
      max_tokens: 8192,
      system_prompt: "You are a helpful programming assistant.",
      title: "Gemini Assistant",
      mcp_servers: []
    }
  };

  const geminiFsConfig: TheaterChatConfig = {
    actor: {
      manifest_path: "/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml"
    },
    config: {
      model_config: {
        model: "gemini-1.5-pro",
        provider: "google"
      },
      temperature: 1.0,
      max_tokens: 8192,
      system_prompt: "You are a helpful programming assistant with filesystem access. You can read, write, and analyze files in the current project.",
      title: "Gemini + Filesystem",
      mcp_servers: [
        {
          "actor_id": null,
          "stdio": {
            "command": "/path/to/fs-mcp-server",
            "args": ["--allowed-dirs", "."]
          },
          "tools": null
        }
      ]
    }
  };

  // Write all configs
  fs.writeFileSync(path.join(configDir, 'default.json'), JSON.stringify(defaultConfig, null, 2));
  fs.writeFileSync(path.join(configDir, 'sonnet.json'), JSON.stringify(sonnetConfig, null, 2));
  fs.writeFileSync(path.join(sonnetDir, 'git.json'), JSON.stringify(sonnetGitConfig, null, 2));
  fs.writeFileSync(path.join(sonnetDir, 'fs.json'), JSON.stringify(sonnetFsConfig, null, 2));
  fs.writeFileSync(path.join(configDir, 'gemini.json'), JSON.stringify(geminiConfig, null, 2));
  fs.writeFileSync(path.join(geminiDir, 'fs.json'), JSON.stringify(geminiFsConfig, null, 2));

  log(`Created default configurations in ${configDir}`);
  console.log(chalk.green(`* Created configuration directory at ${configDir}`));
  console.log(chalk.blue('Available configs:'));
  console.log('  default       - Basic Claude Sonnet 4');
  console.log('  sonnet        - Programming assistant');
  console.log('  sonnet/git    - Sonnet + Git tools');
  console.log('  sonnet/fs     - Sonnet + Filesystem access');
  console.log('  gemini        - Gemini Pro assistant');
  console.log('  gemini/fs     - Gemini + Filesystem access');
  console.log('');
}

function ensureConfigDir(): string {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    createDefaultConfigs(configDir);
  }
  return configDir;
}

function resolveConfigPath(configInput: string): string {
  // Explicit path (contains extension or starts with ./ ../ /)
  if (configInput.includes('.json') || configInput.startsWith('./') || configInput.startsWith('../') || configInput.startsWith('/')) {
    return configInput;
  }

  // Check local .theater-chat directory first
  const localPath = path.join('.theater-chat', `${configInput}.json`);
  if (fs.existsSync(localPath)) {
    log(`Using local config: ${localPath}`);
    return localPath;
  }

  // Ensure global config directory exists
  const configDir = ensureConfigDir();

  // Check global config directory
  const globalPath = path.join(configDir, `${configInput}.json`);
  if (fs.existsSync(globalPath)) {
    log(`Using global config: ${globalPath}`);
    return globalPath;
  }

  // Fall back to treating as filename and let it fail naturally
  return `${configInput}.json`;
}

async function main(options: CLIOptions): Promise<void> {
  let domainActorId: string | null = null;
  let chatActorId: string | null = null;
  let theaterClient: TheaterClient | null = null;

  // Signal handlers - let the UI cleanup handle actor stopping
  process.on('SIGINT', () => {
    log('Received SIGINT - UI will handle cleanup');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Received SIGTERM - UI will handle cleanup');
    process.exit(0);
  });

  try {
    log('Starting theater chat with domain actor pattern');

    // Resolve and load configuration
    const configPath = resolveConfigPath(options.config || 'default');
    const config = loadConfig(configPath);
    log(`Loaded config from: ${configPath}`);
    if (options && options.verbose) {
      log(`Config contents: ${JSON.stringify(config, null, 2)}`);
    }

    // Create Theater client
    log(`Creating Theater client for: ${options.server || '127.0.0.1:9000'}`);
    theaterClient = new TheaterClient(options.server || '127.0.0.1:9000');

    // Start the chat session with domain actor pattern
    const session = await theaterClient.startChatSession(config);
    domainActorId = session.domainActorId;
    chatActorId = session.chatActorId;
    log(`Chat session started - Domain: ${domainActorId}, Chat: ${chatActorId}`);

    // Render the interactive UI
    log('Starting interactive UI...');
    await renderApp(theaterClient, domainActorId, chatActorId, config, options.message);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(chalk.red(`Error: ${errorMessage}`));
    log(`ERROR: ${errorMessage}`, 'ERROR');
    if (errorStack) {
      log(`Stack trace: ${errorStack}`, 'ERROR');
    }
    process.exit(1);
  }
}

function loadConfig(configPath: string): TheaterChatConfig {
  try {
    // Resolve the config path
    const resolvedPath = path.resolve(configPath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Config file not found: ${resolvedPath}`);
    }

    // Read and parse the JSON
    const configContent = fs.readFileSync(resolvedPath, 'utf8');
    const config = JSON.parse(configContent) as TheaterChatConfig;

    // Basic validation
    validateConfig(config);

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    }
    throw error;
  }
}

function validateConfig(config: TheaterChatConfig): void {
  // Check required fields for new domain actor format
  if (!config.actor) {
    throw new Error('Config missing required field: actor');
  }

  if (!config.actor.manifest_path) {
    throw new Error('Config missing required field: actor.manifest_path');
  }

  // Check that manifest file exists
  if (!fs.existsSync(config.actor.manifest_path)) {
    throw new Error(`Actor manifest not found: ${config.actor.manifest_path}`);
  }

  // config.config is domain-specific, so we don't validate its structure here
  // The domain actor will validate its own configuration

  log('Config validation passed');
}

// Enhanced config management functions
function isTheaterChatConfig(obj: any): obj is TheaterChatConfig {
  return obj && typeof obj === 'object' && 
         obj.actor && typeof obj.actor === 'object' &&
         typeof obj.actor.manifest_path === 'string' &&
         obj.config;
}

function isChatConfig(obj: any): obj is ChatConfig {
  return obj && typeof obj === 'object' &&
         obj.model_config && typeof obj.model_config === 'object' &&
         typeof obj.model_config.model === 'string' &&
         typeof obj.model_config.provider === 'string';
}

interface ConfigInfo {
  name: string;
  title: string;
  model: string;
  provider: string;
  hasTools: boolean;
  toolCount: number;
  format: 'legacy' | 'theater' | 'invalid';
}

function analyzeConfig(name: string, configPath: string): ConfigInfo {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const configData = JSON.parse(content);
    
    let title: string;
    let model: string;
    let provider: string;
    let hasTools: boolean;
    let toolCount: number;
    let format: 'legacy' | 'theater' | 'invalid';

    if (isTheaterChatConfig(configData)) {
      format = 'theater';
      const chatConfig = configData.config as ChatConfig;
      title = chatConfig.title || 'No title';
      model = chatConfig.model_config?.model || 'Unknown model';
      provider = chatConfig.model_config?.provider || 'unknown';
      hasTools = (chatConfig.mcp_servers?.length || 0) > 0;
      toolCount = chatConfig.mcp_servers?.length || 0;
    } else if (isChatConfig(configData)) {
      format = 'legacy';
      title = configData.title || 'No title';
      model = configData.model_config?.model || 'Unknown model';
      provider = configData.model_config?.provider || 'unknown';
      hasTools = (configData.mcp_servers?.length || 0) > 0;
      toolCount = configData.mcp_servers?.length || 0;
    } else {
      format = 'invalid';
      title = 'Invalid config format';
      model = 'unknown';
      provider = 'unknown';
      hasTools = false;
      toolCount = 0;
    }

    return { name, title, model, provider, hasTools, toolCount, format };
  } catch (error) {
    return {
      name,
      title: 'Invalid JSON',
      model: 'unknown',
      provider: 'unknown',
      hasTools: false,
      toolCount: 0,
      format: 'invalid'
    };
  }
}

function getProviderIcon(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'anthropic': return '🤖';
    case 'openai': return '⚡';
    case 'google': return '🔍';
    default: return '❓';
  }
}

function getFormatIcon(format: 'legacy' | 'theater' | 'invalid'): string {
  switch (format) {
    case 'theater': return '✅';
    case 'legacy': return '⚠️';
    case 'invalid': return '❌';
  }
}

function groupConfigsByProvider(configs: ConfigInfo[]): Record<string, ConfigInfo[]> {
  const groups = {
    anthropic: [] as ConfigInfo[],
    openai: [] as ConfigInfo[],
    google: [] as ConfigInfo[],
    unknown: [] as ConfigInfo[]
  };

  configs.forEach(config => {
    const provider = config.provider.toLowerCase();
    if (provider === 'anthropic' || provider === 'openai' || provider === 'google') {
      groups[provider].push(config);
    } else {
      groups.unknown.push(config);
    }
  });

  return groups;
}

function collectConfigsInDirectory(dir: string): ConfigInfo[] {
  const configs: ConfigInfo[] = [];
  
  if (!fs.existsSync(dir)) {
    return configs;
  }

  function scanDirectory(currentDir: string, prefix: string = ''): void {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      // Process JSON files
      items
        .filter(item => item.isFile() && item.name.endsWith('.json'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(item => {
          const configName = item.name.replace('.json', '');
          const fullConfigName = prefix ? `${prefix}/${configName}` : configName;
          const configPath = path.join(currentDir, item.name);
          
          const configInfo = analyzeConfig(fullConfigName, configPath);
          configs.push(configInfo);
        });

      // Process subdirectories
      items
        .filter(item => item.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(item => {
          const subdirPath = path.join(currentDir, item.name);
          const newPrefix = prefix ? `${prefix}/${item.name}` : item.name;
          scanDirectory(subdirPath, newPrefix);
        });
        
    } catch (error) {
      configs.push({
        name: prefix || 'ERROR',
        title: `Error reading directory: ${error instanceof Error ? error.message : String(error)}`,
        model: 'unknown',
        provider: 'unknown',
        hasTools: false,
        toolCount: 0,
        format: 'invalid'
      });
    }
  }

  scanDirectory(dir);
  return configs;
}

function displayConfigInfo(config: ConfigInfo, indent: string): void {
  const formatIcon = getFormatIcon(config.format);
  const toolsInfo = config.hasTools ? chalk.green(`[${config.toolCount} tools]`) : chalk.gray('[no tools]');
  const modelInfo = chalk.cyan(config.model);
  
  let statusColor = chalk.green;
  if (config.format === 'invalid') statusColor = chalk.red;
  else if (config.format === 'legacy') statusColor = chalk.yellow;

  console.log(`${indent}${statusColor(config.name)} ${formatIcon}`);
  console.log(`${indent}  ${config.title} (${modelInfo}) ${toolsInfo}`);
  
  if (config.format === 'legacy') {
    console.log(`${indent}  ${chalk.yellow('⚠️  Legacy format - consider updating to theater format')}`);
  }
  if (config.format === 'invalid') {
    console.log(`${indent}  ${chalk.red('❌ Invalid configuration file')}`);
  }
}

function listConfigs(options: ConfigListOptions): void {
  const showGlobal = options.global || options.all;
  const showLocal = !options.global;

  console.log(chalk.blue.bold('🎭 Theater Chat Configurations'));
  console.log('');

  if (showLocal) {
    console.log(chalk.yellow.bold('📁 Local Configurations'));
    const localConfigDir = '.theater-chat';
    console.log(chalk.gray(`   Path: ${path.resolve(localConfigDir)}`));
    console.log('');

    const localConfigs = collectConfigsInDirectory(localConfigDir);
    
    if (localConfigs.length === 0) {
      console.log(chalk.gray('   No configurations found'));
      console.log(chalk.gray('   Run ') + chalk.cyan('theater-chat init') + chalk.gray(' to create local configs'));
    } else {
      const configsByProvider = groupConfigsByProvider(localConfigs);
      
      Object.entries(configsByProvider).forEach(([provider, configs]) => {
        if (configs.length > 0) {
          console.log(chalk.magenta(`   ${getProviderIcon(provider)} ${provider.toUpperCase()}`));
          configs.forEach(config => displayConfigInfo(config, '     '));
          console.log('');
        }
      });
    }
    console.log('');
  }

  if (showGlobal) {
    console.log(chalk.yellow.bold('🌐 Global Configurations'));
    const configDir = getConfigDir();
    console.log(chalk.gray(`   Path: ${configDir}`));
    console.log('');

    const globalConfigs = collectConfigsInDirectory(configDir);
    
    if (globalConfigs.length === 0) {
      console.log(chalk.gray('   No configurations found'));
      console.log(chalk.gray('   Run ') + chalk.cyan('theater-chat init --global') + chalk.gray(' to create global configs'));
    } else {
      const configsByProvider = groupConfigsByProvider(globalConfigs);
      
      Object.entries(configsByProvider).forEach(([provider, configs]) => {
        if (configs.length > 0) {
          console.log(chalk.magenta(`   ${getProviderIcon(provider)} ${provider.toUpperCase()}`));
          configs.forEach(config => displayConfigInfo(config, '     '));
          console.log('');
        }
      });
    }
    console.log('');
  }

  // Usage information
  if (showLocal) {
    const allLocalConfigs = collectConfigsInDirectory('.theater-chat');
    const allGlobalConfigs = showGlobal ? collectConfigsInDirectory(getConfigDir()) : [];
    const allConfigs = [...allLocalConfigs, ...allGlobalConfigs];
    const validConfigs = allConfigs.filter(c => c.format !== 'invalid');
    
    if (validConfigs.length > 0) {
      console.log(chalk.blue.bold('📖 Usage Examples'));
      console.log('');
      
      console.log(chalk.gray('Basic usage:'));
      console.log(`  ${chalk.cyan('theater-chat')}                    # Uses default config`);
      
      const examples = validConfigs.slice(0, 3);
      examples.forEach(config => {
        console.log(`  ${chalk.cyan(`theater-chat --config ${config.name}`)}    # ${config.title}`);
      });
      
      console.log('');
      console.log(chalk.gray('Other commands:'));
      console.log(`  ${chalk.cyan('theater-chat list --all')}          # Show both local and global configs`);
      console.log(`  ${chalk.cyan('theater-chat list --global')}       # Show only global configs`);
      console.log(`  ${chalk.cyan('theater-chat init')}                # Initialize local config directory`);
      console.log('');
      
      if (validConfigs.some(c => c.format === 'legacy')) {
        console.log(chalk.yellow.bold('💡 Migration Tip'));
        console.log(chalk.gray('   Some configs use legacy format. Consider updating them to theater format.'));
        console.log('');
      }
    }
  }
}

// Old listConfigsInDirectory function removed - functionality integrated into collectConfigsInDirectory and displayConfigInfo

function initConfigs(options: ConfigInitOptions): void {
  // Default to local init unless --global is specified
  const initGlobal = options.global;
  const initLocal = !options.global;

  console.log(chalk.blue('* Initializing Configuration Directory'));
  console.log('');

  if (initGlobal) {
    const configDir = getConfigDir();
    if (fs.existsSync(configDir)) {
      console.log(chalk.yellow(`* Global config directory already exists: ${configDir}`));
    } else {
      createDefaultConfigs(configDir);
    }
  }

  if (initLocal) {
    const localConfigDir = '.theater-chat';
    if (fs.existsSync(localConfigDir)) {
      console.log(chalk.yellow(`* Local config directory already exists: ${path.resolve(localConfigDir)}`));
    } else {
      fs.mkdirSync(localConfigDir, { recursive: true });

      // Create a simple example local config
      const exampleConfig: TheaterChatConfig = {
        actor: {
          manifest_path: "/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml"
        },
        config: {
          model_config: {
            model: "claude-sonnet-4-20250514",
            provider: "anthropic"
          },
          temperature: 1.0,
          max_tokens: 8192,
          system_prompt: `You are a helpful programming assistant working on the ${path.basename(process.cwd())} project.`,
          title: `${path.basename(process.cwd())} Assistant`,
          mcp_servers: [
            {
              "actor_id": null,
              "stdio": {
                "command": "/path/to/fs-mcp-server",
                "args": ["--allowed-dirs", "."]
              },
              "tools": null
            }
          ]
        }
      };

      fs.writeFileSync(
        path.join(localConfigDir, 'default.json'),
        JSON.stringify(exampleConfig, null, 2)
      );

      console.log(chalk.green(`* Created local config directory: ${path.resolve(localConfigDir)}`));
      console.log(chalk.blue('  Created example config:'));
      console.log(`    default - ${exampleConfig.config.title}`);
      console.log('');
      console.log(chalk.gray('  Tip: Add .theater-chat/ to your .gitignore to keep configs private'));
    }
  }

  console.log('');
  console.log(chalk.blue('* Next steps:'));
  console.log('  theater-chat list               # See local configs');
  console.log('  theater-chat list --all         # See all configs');
  console.log('  theater-chat                    # Start chat with default config');
  console.log('  theater-chat --config sonnet    # Use a specific config');
}

// Main is now called automatically by Commander when no subcommand is provided

// Enhanced config listing replacement for theater-chat src/index.ts
// Replace your existing listConfigs and listConfigsInDirectory functions with these

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import type { ChatConfig, TheaterChatConfig, ConfigListOptions } from './types.js';

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
  const groups: Record<string, ConfigInfo[]> = {
    anthropic: [],
    openai: [],
    google: [],
    unknown: []
  };

  configs.forEach(config => {
    const provider = config.provider.toLowerCase();
    if (groups[provider]) {
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
      // Add error config entry
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

// ENHANCED VERSION - Replace your existing listConfigs function with this
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

// Remove your existing listConfigsInDirectory function - it's replaced by the functions above

export { listConfigs };

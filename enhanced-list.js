#!/usr/bin/env node

// Enhanced config listing tool for theater-chat
// This is a standalone script to test the enhanced functionality

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import os from 'os';

function getConfigDir() {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'theater-chat');
  }
  return path.join(os.homedir(), '.config', 'theater-chat');
}

function isTheaterChatConfig(obj) {
  return obj && typeof obj === 'object' && 
         obj.actor && typeof obj.actor === 'object' &&
         typeof obj.actor.manifest_path === 'string' &&
         obj.config;
}

function isChatConfig(obj) {
  return obj && typeof obj === 'object' &&
         obj.model_config && typeof obj.model_config === 'object' &&
         typeof obj.model_config.model === 'string' &&
         typeof obj.model_config.provider === 'string';
}

function analyzeConfig(name, configPath) {
  try {
    const stats = fs.statSync(configPath);
    const content = fs.readFileSync(configPath, 'utf8');
    const configData = JSON.parse(content);
    
    let title, model, provider, hasTools, toolCount, format;

    if (isTheaterChatConfig(configData)) {
      format = 'theater';
      const chatConfig = configData.config;
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

    return {
      name,
      title,
      model,
      provider,
      path: configPath,
      hasTools,
      toolCount,
      format,
      size: formatFileSize(stats.size),
      modified: stats.mtime.toLocaleDateString()
    };

  } catch (error) {
    return {
      name,
      title: 'Invalid JSON',
      model: 'unknown',
      provider: 'unknown', 
      path: configPath,
      hasTools: false,
      toolCount: 0,
      format: 'invalid',
      size: '0B',
      modified: 'unknown'
    };
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

function getConfigsInDirectory(dir) {
  const configs = [];
  
  if (!fs.existsSync(dir)) {
    return configs;
  }

  function scanDirectory(currentDir, prefix = '') {
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
        title: `Error reading directory: ${error.message}`,
        model: 'unknown',
        provider: 'unknown',
        path: currentDir,
        hasTools: false,
        toolCount: 0,
        format: 'invalid',
        size: '0B',
        modified: 'unknown'
      });
    }
  }

  scanDirectory(dir);
  return configs;
}

function getProviderIcon(provider) {
  switch (provider.toLowerCase()) {
    case 'anthropic': return '🤖';
    case 'openai': return '⚡';
    case 'google': return '🔍';
    default: return '❓';
  }
}

function getFormatIcon(format) {
  switch (format) {
    case 'theater': return '✅';
    case 'legacy': return '⚠️';
    case 'invalid': return '❌';
  }
}

function groupConfigsByProvider(configs) {
  const groups = {
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

function displayConfigInfo(config, indent) {
  const formatIcon = getFormatIcon(config.format);
  const toolsInfo = config.hasTools ? chalk.green(`[${config.toolCount} tools]`) : chalk.gray('[no tools]');
  const modelInfo = chalk.cyan(config.model);
  
  let statusColor = chalk.green;
  if (config.format === 'invalid') statusColor = chalk.red;
  else if (config.format === 'legacy') statusColor = chalk.yellow;

  console.log(`${indent}${statusColor(config.name)} ${formatIcon}`);
  console.log(`${indent}  ${config.title} (${modelInfo}) ${toolsInfo}`);
  if (config.format === 'legacy') {
    console.log(`${indent}  ${chalk.yellow('⚠️  Legacy format - consider updating')}`);
  }
  if (config.format === 'invalid') {
    console.log(`${indent}  ${chalk.red('❌ Invalid configuration file')}`);
  }
}

function enhancedListConfigs() {
  console.log(chalk.blue.bold('🎭 Theater Chat Configurations'));
  console.log('');

  // Get local configs
  const localConfigDir = '.theater-chat';
  const localConfigs = getConfigsInDirectory(localConfigDir);
  
  // Get global configs
  const globalConfigDir = getConfigDir();
  const globalConfigs = getConfigsInDirectory(globalConfigDir);

  // Display local configs
  console.log(chalk.yellow.bold('📁 Local Configurations'));
  console.log(chalk.gray(`   Path: ${path.resolve(localConfigDir)}`));
  console.log('');

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

  // Display global configs
  console.log(chalk.yellow.bold('🌐 Global Configurations'));
  console.log(chalk.gray(`   Path: ${globalConfigDir}`));
  console.log('');

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

  // Display usage info
  const allConfigs = [...localConfigs, ...globalConfigs];
  const validConfigs = allConfigs.filter(c => c.format !== 'invalid');
  
  if (validConfigs.length > 0) {
    console.log('');
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
    console.log(`  ${chalk.cyan('theater-chat init')}                # Initialize local config directory`);
  }
  
  console.log('');
}

// Run the enhanced listing
enhancedListConfigs();

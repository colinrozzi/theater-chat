#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TheaterClient } from './theater.js';
import { renderApp } from './ui.js';
import { initializeLogger, createComponentLogger } from './logger.js';
import type {
  ChatConfig,
  TheaterChatConfig,
  CLIOptions,
  ConfigListOptions,
  ConfigInitOptions
} from './types.js';

const log = createComponentLogger('Main');

program
  .name('theater-chat')
  .description('Configurable inline chat interface for Theater actors')
  .option('-c, --config <path>', 'Path to chat configuration JSON file', 'default')
  .option('-s, --server <address>', 'Theater server address', '127.0.0.1:9000')
  .option('-v, --verbose', 'Enable verbose logging to console and file')
  .option('--log', 'Enable file logging (quiet mode)')
  .option('--debug', 'Enable debug level logging with detailed information')
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

  log.info(`Created default configurations in ${configDir}`);
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
    log.info(`Using local config: ${localPath}`);
    return localPath;
  }

  // Ensure global config directory exists
  const configDir = ensureConfigDir();

  // Check global config directory
  const globalPath = path.join(configDir, `${configInput}.json`);
  if (fs.existsSync(globalPath)) {
    log.info(`Using global config: ${globalPath}`);
    return globalPath;
  }

  // Fall back to treating as filename and let it fail naturally
  return `${configInput}.json`;
}

async function main(options: CLIOptions & { log?: boolean; debug?: boolean }): Promise<void> {
  // Initialize the centralized logger first
  initializeLogger({
    verbose: options.verbose || false,
    log: options.log || false,
    debug: options.debug || process.env.NODE_ENV === 'development' || false
  });
  let domainActorId: string | null = null;
  let chatActorId: string | null = null;
  let theaterClient: TheaterClient | null = null;

  // Signal handlers - let the UI cleanup handle actor stopping
  process.on('SIGINT', () => {
    log.info('Received SIGINT - UI will handle cleanup');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log.info('Received SIGTERM - UI will handle cleanup');
    process.exit(0);
  });

  try {
    log.info('Starting theater chat session');

    // Resolve and load configuration
    const configPath = resolveConfigPath(options.config || 'default');
    const config = loadConfig(configPath);
    log.info(`Loaded config from: ${configPath}`);
    if (options && options.verbose) {
      log.debug(`Config contents: ${JSON.stringify(config, null, 2)}`);
    }

    // Create Theater client
    log.info(`Creating Theater client for: ${options.server || '127.0.0.1:9000'}`);
    theaterClient = new TheaterClient(options.server || '127.0.0.1:9000');

    // Start the chat session - actors only, no StartChat yet
    console.log('🚀 Starting chat session...');
    console.log('📋 Step 1: Starting domain actor...');
    
    const session = await theaterClient.startChatSession(config);
    domainActorId = session.domainActorId;
    chatActorId = session.chatActorId;
    
    console.log('📋 Step 2: Setting up UI channel...');
    console.log('🤖 Step 3: Starting chat automation...');
    
    log.info(`Chat session prepared - Domain: ${domainActorId}, Chat: ${chatActorId}`);

    // Render the interactive UI - will handle StartChat after channel is ready
    log.info('Starting interactive UI...');
    await renderApp(theaterClient, domainActorId, chatActorId, config, options.message);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(chalk.red(`Error: ${errorMessage}`));
    log.error(`ERROR: ${errorMessage}`);
    if (errorStack) {
      log.error(`Stack trace: ${errorStack}`);
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

  log.info('Config validation passed');
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
  description?: string;  // Optional field
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
    let description: string | undefined;
    let model: string;
    let provider: string;
    let hasTools: boolean;
    let toolCount: number;
    let format: 'legacy' | 'theater' | 'invalid';

    if (isTheaterChatConfig(configData)) {
      format = 'theater';
      const chatConfig = configData.config as ChatConfig;
      title = chatConfig.title || 'No title';
      description = chatConfig.description;
      model = chatConfig.model_config?.model || 'Unknown model';
      provider = chatConfig.model_config?.provider || 'unknown';
      hasTools = (chatConfig.mcp_servers?.length || 0) > 0;
      toolCount = chatConfig.mcp_servers?.length || 0;
    } else if (isChatConfig(configData)) {
      format = 'legacy';
      title = configData.title || 'No title';
      description = configData.description;
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

    const result: ConfigInfo = { name, title, model, provider, hasTools, toolCount, format };
    if (description) {
      result.description = description;
    }
    return result;
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

function getModelDisplayName(model: string): string {
  // Clean up model names for better display
  const modelMap: Record<string, string> = {
    'claude-sonnet-4-20250514': 'Claude Sonnet 4',
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-3-opus-20240229': 'Claude 3 Opus',
    'gpt-4': 'GPT-4',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
    'gemini-1.5-flash': 'Gemini 1.5 Flash',
    'gemini-2.5-pro-preview-06-05': 'Gemini 2.5 Pro (Preview)',
  };
  
  return modelMap[model] || model;
}

function formatConfigName(name: string, format: 'legacy' | 'theater' | 'invalid'): string {
  const maxLength = 20;
  const truncated = name.length > maxLength ? name.substring(0, maxLength - 1) + '…' : name;
  
  let statusColor = chalk.green;
  if (format === 'invalid') statusColor = chalk.red;
  else if (format === 'legacy') statusColor = chalk.yellow;
  
  return statusColor.bold(truncated);
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
}

function displayConfigInfo(config: ConfigInfo, indent: string): void {
  const formatIcon = getFormatIcon(config.format);
  const modelDisplay = getModelDisplayName(config.model);
  const toolsIndicator = config.hasTools ? chalk.green(`●`) : chalk.gray(`○`);
  
  // Main config line - cleaner format
  const configLine = `${formatConfigName(config.name, config.format)} ${formatIcon}`;
  const modelLine = chalk.cyan(modelDisplay);
  const toolsLine = `${toolsIndicator} ${config.toolCount} ${config.toolCount === 1 ? 'tool' : 'tools'}`;
  
  console.log(`${indent}${configLine}`);
  console.log(`${indent}${chalk.gray('├─')} ${config.title}`);
  
  // Show description if available
  if (config.description) {
    const wrappedDescription = wrapText(config.description, 60);
    wrappedDescription.forEach((line, index) => {
      const prefix = index === 0 ? '├─' : '│ ';
      console.log(`${indent}${chalk.gray(prefix)} ${chalk.italic.gray(line)}`);
    });
  }
  
  console.log(`${indent}${chalk.gray('├─')} ${modelLine} ${chalk.gray('•')} ${toolsLine}`);
  
  // Format warnings - more subtle
  if (config.format === 'legacy') {
    console.log(`${indent}${chalk.gray('└─')} ${chalk.yellow('⚠ Legacy format')}`);
  } else if (config.format === 'invalid') {
    console.log(`${indent}${chalk.gray('└─')} ${chalk.red('✗ Invalid configuration')}`);
  } else {
    console.log(`${indent}${chalk.gray('└─')} ${chalk.green('✓ Theater format')}`);
  }
}

function displayProviderSection(provider: string, configs: ConfigInfo[], indent: string): void {
  const icon = getProviderIcon(provider);
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  const count = configs.length;
  
  console.log(`${indent}${icon} ${chalk.magenta.bold(providerName)} ${chalk.gray(`(${count})`)}`);
  console.log('');
  
  configs.forEach((config, index) => {
    displayConfigInfo(config, indent + '  ');
    
    // Add spacing between configs, but not after the last one
    if (index < configs.length - 1) {
      console.log('');
    }
  });
}

function displayProviderSectionMinimal(provider: string, configs: ConfigInfo[]): void {
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  const count = configs.length;
  
  console.log(chalk.magenta.bold(`${providerName} (${count})`));
  console.log('');
  
  configs.forEach((config, index) => {
    displayConfigInfoMinimal(config);
    
    // Add spacing between configs, but not after the last one
    if (index < configs.length - 1) {
      console.log('');
    }
  });
}

function displayConfigInfoMinimal(config: ConfigInfo): void {
  const modelDisplay = getModelDisplayName(config.model);
  const toolsIndicator = config.hasTools ? chalk.green(`●`) : chalk.gray(`○`);
  
  let statusColor = chalk.green;
  if (config.format === 'invalid') statusColor = chalk.red;
  else if (config.format === 'legacy') statusColor = chalk.yellow;
  
  // Simple one-line format
  const configLine = `  ${statusColor.bold(config.name)}`;
  const modelLine = chalk.cyan(modelDisplay);
  const toolsLine = `${toolsIndicator} ${config.toolCount} ${config.toolCount === 1 ? 'tool' : 'tools'}`;
  
  console.log(`${configLine} - ${config.title}`);
  console.log(`  ${modelLine} • ${toolsLine}`);
  
  // Show description if available
  if (config.description) {
    const wrappedDescription = wrapText(config.description, 60);
    wrappedDescription.forEach(line => {
      console.log(`  ${chalk.italic.gray(line)}`);
    });
  }
}

function listConfigs(options: ConfigListOptions): void {
  const showGlobal = options.global || options.all;
  const showLocal = !options.global;

  // Minimal output - no main header

  if (showLocal) {
    // For local-only view, show minimal output
    if (!showGlobal) {
      const localConfigs = collectConfigsInDirectory('.theater-chat');
      
      if (localConfigs.length === 0) {
        console.log(chalk.gray('No configurations found'));
        console.log(chalk.gray('Run ') + chalk.cyan('theater-chat init') + chalk.gray(' to create configs'));
      } else {
        const configsByProvider = groupConfigsByProvider(localConfigs);
        const providers = Object.entries(configsByProvider).filter(([_, configs]) => configs.length > 0);
        
        providers.forEach(([provider, configs], index) => {
          displayProviderSectionMinimal(provider, configs);
          
          // Add spacing between provider sections, but not after the last one
          if (index < providers.length - 1) {
            console.log('');
          }
        });
      }
    } else {
      // For --all view, show minimal format with just a header
      console.log(chalk.bold('Local'));
      console.log('');

      const localConfigs = collectConfigsInDirectory('.theater-chat');
      
      if (localConfigs.length === 0) {
        console.log(chalk.gray('No configurations found'));
        console.log(chalk.gray('Run ') + chalk.cyan('theater-chat init') + chalk.gray(' to create configs'));
      } else {
        const configsByProvider = groupConfigsByProvider(localConfigs);
        const providers = Object.entries(configsByProvider).filter(([_, configs]) => configs.length > 0);
        
        providers.forEach(([provider, configs], index) => {
          displayProviderSectionMinimal(provider, configs);
          
          // Add spacing between provider sections, but not after the last one
          if (index < providers.length - 1) {
            console.log('');
          }
        });
      }
      console.log('');
    }
  }

  if (showGlobal) {
    // For global-only view, clean minimal output
    if (!showLocal) {
      const globalConfigs = collectConfigsInDirectory(getConfigDir());
      
      if (globalConfigs.length === 0) {
        console.log(chalk.gray('No global configurations found'));
        console.log(chalk.gray('Run ') + chalk.cyan('theater-chat init --global') + chalk.gray(' to create configs'));
      } else {
        const configsByProvider = groupConfigsByProvider(globalConfigs);
        const providers = Object.entries(configsByProvider).filter(([_, configs]) => configs.length > 0);
        
        providers.forEach(([provider, configs], index) => {
          displayProviderSectionMinimal(provider, configs);
          
          // Add spacing between provider sections, but not after the last one
          if (index < providers.length - 1) {
            console.log('');
          }
        });
      }
    } else {
      // For --all view, show with header
      console.log(chalk.bold('Global'));
      console.log('');

      const globalConfigs = collectConfigsInDirectory(getConfigDir());
      
      if (globalConfigs.length === 0) {
        console.log(chalk.gray('No configurations found'));
        console.log(chalk.gray('Run ') + chalk.cyan('theater-chat init --global') + chalk.gray(' to create configs'));
      } else {
        const configsByProvider = groupConfigsByProvider(globalConfigs);
        const providers = Object.entries(configsByProvider).filter(([_, configs]) => configs.length > 0);
        
        providers.forEach(([provider, configs], index) => {
          displayProviderSectionMinimal(provider, configs);
          
          // Add spacing between provider sections, but not after the last one
          if (index < providers.length - 1) {
            console.log('');
          }
        });
      }
      console.log('');
    }
  }

  // No usage section - keep it minimal
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

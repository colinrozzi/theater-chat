#!/usr/bin/env bun

import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TheaterClient } from './theater.js';
import { renderApp } from './ui.js';

// Set up logging
const logFile = path.join(process.cwd(), 'theater-chat.log');
function log(message, level = 'INFO') {
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

// Remove the manual command checking since Commander handles this now

function getConfigDir() {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'theater-chat');
  }
  return path.join(os.homedir(), '.config', 'theater-chat');
}

function createDefaultConfigs(configDir) {
  // Create the config directory
  fs.mkdirSync(configDir, { recursive: true });
  
  // Default config - Claude Sonnet 4
  const defaultConfig = {
    model_config: {
      model: "claude-sonnet-4-20250514",
      provider: "anthropic"
    },
    temperature: 1.0,
    max_tokens: 8192,
    system_prompt: "You are a helpful assistant.",
    title: "Theater Chat",
    mcp_servers: []
  };
  
  // Sonnet base config
  const sonnetConfig = {
    model_config: {
      model: "claude-sonnet-4-20250514",
      provider: "anthropic"
    },
    temperature: 1.0,
    max_tokens: 8192,
    system_prompt: "You are a helpful programming assistant.",
    title: "Sonnet Assistant",
    mcp_servers: []
  };
  
  // Create sonnet directory and specialized configs
  const sonnetDir = path.join(configDir, 'sonnet');
  fs.mkdirSync(sonnetDir, { recursive: true });
  
  const sonnetGitConfig = {
    ...sonnetConfig,
    system_prompt: "You are a helpful programming assistant with git access. You can help with version control, reviewing changes, and managing repositories.",
    title: "Sonnet + Git",
    mcp_servers: [
      {
        "actor_id": null,
        "actor": {
          "manifest_path": "/path/to/git-mcp-actor/manifest.toml"
        },
        "tools": null
      }
    ]
  };
  
  const sonnetFsConfig = {
    ...sonnetConfig,
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
  };
  
  // Gemini configs
  const geminiDir = path.join(configDir, 'gemini');
  fs.mkdirSync(geminiDir, { recursive: true });
  
  const geminiConfig = {
    model_config: {
      model: "gemini-1.5-pro",
      provider: "google"
    },
    temperature: 1.0,
    max_tokens: 8192,
    system_prompt: "You are a helpful programming assistant.",
    title: "Gemini Assistant",
    mcp_servers: []
  };
  
  // Write all configs
  fs.writeFileSync(path.join(configDir, 'default.json'), JSON.stringify(defaultConfig, null, 2));
  fs.writeFileSync(path.join(configDir, 'sonnet.json'), JSON.stringify(sonnetConfig, null, 2));
  fs.writeFileSync(path.join(sonnetDir, 'git.json'), JSON.stringify(sonnetGitConfig, null, 2));
  fs.writeFileSync(path.join(sonnetDir, 'fs.json'), JSON.stringify(sonnetFsConfig, null, 2));
  fs.writeFileSync(path.join(configDir, 'gemini.json'), JSON.stringify(geminiConfig, null, 2));
  fs.writeFileSync(path.join(geminiDir, 'fs.json'), JSON.stringify({
    ...geminiConfig,
    title: "Gemini + Filesystem",
    system_prompt: "You are a helpful programming assistant with filesystem access. You can read, write, and analyze files in the current project.",
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
  }, null, 2));
  
  log(`Created default configurations in ${configDir}`);
  console.log(chalk.green(`✓ Created configuration directory at ${configDir}`));
  console.log(chalk.blue('Available configs:'));
  console.log('  default       - Basic Claude Sonnet 4');
  console.log('  sonnet        - Programming assistant');
  console.log('  sonnet/git    - Sonnet + Git tools');
  console.log('  sonnet/fs     - Sonnet + Filesystem access');
  console.log('  gemini        - Gemini Pro assistant');
  console.log('  gemini/fs     - Gemini + Filesystem access');
  console.log('');
}

function ensureConfigDir() {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    createDefaultConfigs(configDir);
  }
  return configDir;
}

function resolveConfigPath(configInput) {
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

async function main(options) {
  let actorId = null;
  let theaterClient = null;

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
    log('Starting theater chat');

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

    // Start the chat actor
    actorId = await theaterClient.startChatActor(config);
    log(`Chat actor started: ${actorId}`);

    // Render the interactive UI
    log('Starting interactive UI...');
    await renderApp(theaterClient, actorId, config, options.message);

  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    log(`ERROR: ${error.message}`, 'ERROR');
    log(`Stack trace: ${error.stack}`, 'ERROR');
    process.exit(1);
  }
}

function loadConfig(configPath) {
  try {
    // Resolve the config path
    const resolvedPath = path.resolve(configPath);
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Config file not found: ${resolvedPath}`);
    }

    // Read and parse the JSON
    const configContent = fs.readFileSync(resolvedPath, 'utf8');
    const config = JSON.parse(configContent);

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

function validateConfig(config) {
  // Check required fields
  if (!config.model_config) {
    throw new Error('Config missing required field: model_config');
  }
  
  if (!config.model_config.model) {
    throw new Error('Config missing required field: model_config.model');
  }
  
  if (!config.model_config.provider) {
    throw new Error('Config missing required field: model_config.provider');
  }

  // Validate optional fields have reasonable defaults
  if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
    throw new Error('Config temperature must be between 0 and 2');
  }

  if (config.max_tokens !== undefined && config.max_tokens < 1) {
    throw new Error('Config max_tokens must be positive');
  }

  log('Config validation passed');
}

// Config management functions
function listConfigs(options) {
  // Default to showing only local, unless --global or --all is specified
  const showGlobal = options.global || options.all;
  const showLocal = !options.global; // Show local unless --global is specified
  
  console.log(chalk.blue('📋 Available Configurations'));
  console.log('');
  
  if (showLocal) {
    console.log(chalk.yellow('📁 Local Configurations'));
    const localConfigDir = '.theater-chat';
    
    if (!fs.existsSync(localConfigDir)) {
      console.log(chalk.gray('  No local config directory found'));
      console.log(chalk.gray(`  Run 'theater-chat init' to create`));
    } else {
      listConfigsInDirectory(localConfigDir, '  ');
    }
    console.log('');
  }
  
  if (showGlobal) {
    console.log(chalk.yellow('🌍 Global Configurations'));
    const configDir = getConfigDir();
    
    if (!fs.existsSync(configDir)) {
      console.log(chalk.gray('  No global config directory found'));
      console.log(chalk.gray(`  Run 'theater-chat init --global' to create`));
    } else {
      listConfigsInDirectory(configDir, '  ');
    }
    console.log('');
  }
  
  if (showLocal) {
    console.log(chalk.blue('💡 Usage:'));
    console.log('  theater-chat                    # Uses default config');
    console.log('  theater-chat --config sonnet    # Uses sonnet config');
    console.log('  theater-chat --config sonnet/fs # Uses sonnet/fs config');
    console.log('');
    console.log(chalk.gray('  Use --all to see global configs, --global for global only'));
  }
}

function listConfigsInDirectory(dir, indent = '', prefix = '') {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    const configs = [];
    const subdirs = [];
    
    for (const item of items) {
      if (item.isFile() && item.name.endsWith('.json')) {
        const configName = item.name.replace('.json', '');
        configs.push(configName);
      } else if (item.isDirectory()) {
        subdirs.push(item.name);
      }
    }
    
    // Sort and display configs
    configs.sort().forEach(config => {
      const configPath = path.join(dir, `${config}.json`);
      const fullConfigName = prefix ? `${prefix}/${config}` : config;
      try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const title = configData.title || 'No title';
        const model = configData.model_config?.model || 'Unknown model';
        console.log(`${indent}${chalk.green(fullConfigName)} - ${chalk.cyan(title)} (${chalk.gray(model)})`);
      } catch (error) {
        console.log(`${indent}${chalk.green(fullConfigName)} - ${chalk.red('Invalid JSON')}`);
      }
    });
    
    // Recursively list subdirectories
    subdirs.sort().forEach(subdir => {
      const subdirPath = path.join(dir, subdir);
      const subdirItems = fs.readdirSync(subdirPath, { withFileTypes: true });
      const hasConfigs = subdirItems.some(item => item.isFile() && item.name.endsWith('.json'));
      
      if (hasConfigs) {
        const newPrefix = prefix ? `${prefix}/${subdir}` : subdir;
        listConfigsInDirectory(subdirPath, indent, newPrefix);
      }
    });
    
    if (configs.length === 0 && subdirs.length === 0) {
      console.log(`${indent}${chalk.gray('No configurations found')}`);
    }
  } catch (error) {
    console.log(`${indent}${chalk.red('Error reading directory:')} ${error.message}`);
  }
}

function initConfigs(options) {
  // Default to local init unless --global is specified
  const initGlobal = options.global;
  const initLocal = !options.global;
  
  console.log(chalk.blue('🚀 Initializing Configuration Directory'));
  console.log('');
  
  if (initGlobal) {
    const configDir = getConfigDir();
    if (fs.existsSync(configDir)) {
      console.log(chalk.yellow(`✓ Global config directory already exists: ${configDir}`));
    } else {
      createDefaultConfigs(configDir);
    }
  }
  
  if (initLocal) {
    const localConfigDir = '.theater-chat';
    if (fs.existsSync(localConfigDir)) {
      console.log(chalk.yellow(`✓ Local config directory already exists: ${path.resolve(localConfigDir)}`));
    } else {
      fs.mkdirSync(localConfigDir, { recursive: true });
      
      // Create a simple example local config
      const exampleConfig = {
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
      };
      
      fs.writeFileSync(
        path.join(localConfigDir, 'default.json'), 
        JSON.stringify(exampleConfig, null, 2)
      );
      
      console.log(chalk.green(`✓ Created local config directory: ${path.resolve(localConfigDir)}`));
      console.log(chalk.blue('  Created example config:'));
      console.log(`    default - ${exampleConfig.title}`);
      console.log('');
      console.log(chalk.gray('  Tip: Add .theater-chat/ to your .gitignore to keep configs private'));
    }
  }
  
  console.log('');
  console.log(chalk.blue('💡 Next steps:'));
  console.log('  theater-chat list               # See local configs');
  console.log('  theater-chat list --all         # See all configs');
  console.log('  theater-chat                    # Start chat with default config');
  console.log('  theater-chat --config sonnet    # Use a specific config');
}

// Main is now called automatically by Commander when no subcommand is provided

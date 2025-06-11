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
  .parse();

const options = program.opts();

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
          "args": ["--allowed-dirs", process.cwd()]
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

async function main() {
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
    const configPath = resolveConfigPath(options.config);
    const config = loadConfig(configPath);
    log(`Loaded config from: ${configPath}`);
    if (options.verbose) {
      log(`Config contents: ${JSON.stringify(config, null, 2)}`);
    }

    // Create Theater client
    log(`Creating Theater client for: ${options.server}`);
    theaterClient = new TheaterClient(options.server);

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

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});

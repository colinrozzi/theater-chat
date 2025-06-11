#!/usr/bin/env bun#!/usr/bin/env bun

import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
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
  .requiredOption('-c, --config <path>', 'Path to chat configuration JSON file')
  .option('-s, --server <address>', 'Theater server address', '127.0.0.1:9000')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-m, --message <text>', 'Send an initial message to start the conversation')
  .parse();

const options = program.opts();

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

    // Load configuration
    const config = loadConfig(options.config);
    log(`Loaded config from: ${options.config}`);
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

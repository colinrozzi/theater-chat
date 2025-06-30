#!/usr/bin/env node

/**
 * Theater Chat - Configurable inline chat interface for Theater actors
 * 
 * Usage:
 *   theater-chat <config-name>     # Start chat with config (e.g., sonnet, sonnet/fs)
 *   theater-chat list              # List available configs
 *   theater-chat init              # Initialize config directories
 */

import { program } from 'commander';
import chalk from 'chalk';
import { renderChatApp } from './ui/ChatUI.js';
import { resolveConfigPath, listConfigs, initConfigs } from './config-resolver.js';
import type { CLIOptions, ChatConfig, ChatProxyInitialState, ConfigFile } from './types.js';

// Reserved command words that should not be treated as config names
const RESERVED_COMMANDS = ['list', 'init'];

/**
 * Convert config file to ChatConfig format
 */
function convertToNewConfigFormat(loadedConfig: ConfigFile): ChatConfig {
  // Validate that it's in the required new format
  if (!loadedConfig.actor || !loadedConfig.config) {
    throw new Error('Configuration must include both "actor" and "config" sections. Please update your config to the new format.');
  }
  
  if (!loadedConfig.actor.manifest_path) {
    throw new Error('Configuration must specify "actor.manifest_path".');
  }
  
  return {
    actor: {
      manifest_path: loadedConfig.actor.manifest_path,
      initial_state: loadedConfig.config
    }
  };
}

// Main program setup
program
  .name('theater-chat')
  .description('Configurable inline chat interface for Theater actors')
  .version('0.1.0')
  .option('--server <address>', 'Theater server address', '127.0.0.1:9000')
  .option('--message <text>', 'Send an initial message to start the conversation')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options, command) => {
    const args = command.args;
    
    if (args.length === 0) {
      console.error(chalk.red('❌ No command or config specified'));
      console.log(chalk.gray('Usage: theater-chat <config-name> | list | init'));
      console.log(chalk.gray('Try: theater-chat list'));
      process.exit(1);
    }

    const firstArg = args[0];

    // Handle reserved commands
    if (firstArg === 'list') {
      handleListCommand();
      return;
    }

    if (firstArg === 'init') {
      handleInitCommand(args.slice(1));
      return;
    }

    // Treat as config name
    await handleChatCommand(firstArg, {
      server: options.server,
      message: options.message,
      verbose: options.verbose
    });
  });

// Parse command line arguments
program.parse();

/**
 * Handle the 'list' command - show available configs
 */
function handleListCommand(): void {
  console.log(chalk.bold('📋 Available Configurations:'));
  console.log();
  
  const configs = listConfigs();
  
  if (configs.length === 0) {
    console.log(chalk.yellow('No configurations found.'));
    console.log(chalk.gray('Run `theater-chat init` to create default configs.'));
    return;
  }

  // Group by source
  const localConfigs = configs.filter(c => c.source === 'local');
  const globalConfigs = configs.filter(c => c.source === 'global');

  if (localConfigs.length > 0) {
    console.log(chalk.blue('🏠 Local (.theater-chat/):'));
    for (const config of localConfigs) {
      console.log(`  ${chalk.green(config.name)} ${chalk.gray(`(${config.path})`)}`);
    }
    console.log();
  }

  if (globalConfigs.length > 0) {
    console.log(chalk.blue('🌍 Global (~/.config/theater-chat/):'));
    for (const config of globalConfigs) {
      console.log(`  ${chalk.green(config.name)} ${chalk.gray(`(${config.path})`)}`);
    }
    console.log();
  }

  console.log(chalk.gray('Usage: theater-chat <config-name>'));
  console.log(chalk.gray('Example: theater-chat sonnet'));
}

/**
 * Handle the 'init' command - initialize config directories
 */
function handleInitCommand(args: string[]): void {
  console.log(chalk.bold('🚀 Initializing Theater Chat configurations...'));
  console.log();

  const target = args[0] as 'local' | 'global' | 'both' || 'local';
  
  if (target && !['local', 'global', 'both'].includes(target)) {
    console.error(chalk.red(`❌ Invalid target: ${target}`));
    console.log(chalk.gray('Valid targets: local, global, both'));
    process.exit(1);
  }

  try {
    initConfigs(target);
    console.log();
    console.log(chalk.green('✅ Initialization complete!'));
    console.log(chalk.gray('Run `theater-chat list` to see available configs.'));
  } catch (error) {
    console.error(chalk.red(`❌ Error during initialization: ${error}`));
    process.exit(1);
  }
}

/**
 * Handle chat commands - load config and start chat
 */
async function handleChatCommand(configName: string, options: CLIOptions): Promise<void> {
  try {
    // Resolve the config
    const resolved = resolveConfigPath(configName);
    
    if (!resolved) {
      console.error(chalk.red(`❌ Config not found: ${configName}`));
      console.log(chalk.gray('Available configs:'));
      
      const configs = listConfigs();
      if (configs.length === 0) {
        console.log(chalk.gray('  (none found - run `theater-chat init` to create defaults)'));
      } else {
        for (const config of configs.slice(0, 5)) {
          console.log(chalk.gray(`  ${config.name}`));
        }
        if (configs.length > 5) {
          console.log(chalk.gray(`  ... and ${configs.length - 5} more`));
        }
      }
      process.exit(1);
    }

    console.log(chalk.blue(`📝 Using ${resolved.source} config: ${chalk.bold(configName)}`));
    console.log(chalk.gray(`   Path: ${resolved.path}`));
    console.log();

    // Handle both old and new config formats
    const chatConfig: ChatConfig = convertToNewConfigFormat(resolved.config);

    // Add initial message if provided
    if (options.message) {
      if (!chatConfig.actor.initial_state) {
        chatConfig.actor.initial_state = {};
      }
      chatConfig.actor.initial_state.initial_message = options.message;
    }

    // Start the interactive UI
    await renderChatApp(options, chatConfig);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`❌ Error: ${errorMessage}`));

    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }

    process.exit(1);
  }
}

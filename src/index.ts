#!/usr/bin/env node

/**
 * Git Agent - Git workflows powered by AI
 * 
 * Usage:
 *   commit          # Start commit workflow
 *   review          # Start review workflow  
 *   rebase          # Start rebase workflow
 *   git-chat        # General git chat
 *   git-agent       # With explicit command
 */

import { program } from 'commander';
import chalk from 'chalk';
import { renderChatApp } from './ui/ChatUI.js';
import type { CLIOptions, ChatConfig } from './types.js';

// Main program setup
program
  .name('theater-chat')
  .description('Chat')
  .version('1.0.0');

runWorkflow({
  server: '127.0.0.1:9000',
  verbose: false
});

/**
 * Run a git workflow
 */
async function runWorkflow(options: CLIOptions): Promise<void> {
  try {
    let config: ChatConfig = {
      actor: {
        manifest_path: '/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml',
      }
    };

    // Start the interactive UI
    await renderChatApp(options, config);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`❌ Error: ${errorMessage}`));

    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }

    process.exit(1);
  }
}

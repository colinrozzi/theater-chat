#!/usr/bin/env bun

import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { findGitRepository, getGitContext } from './git.js';
import { TheaterClient } from './theater.js';
import { renderApp } from './ui.js';

// Set up logging
const logFile = path.join(process.cwd(), 'th-git-js.log');
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
}

// Clear log file on start
fs.writeFileSync(logFile, `=== th-git-js started at ${new Date().toISOString()} ===\n`);
log('Application started');

// Define predefined workflows
const WORKFLOWS = {
  commit: {
    prompt: `Please analyze the current changes in this repository and help me commit them appropriately. Here's what I'd like you to do:

1. First, examine the current git status and staged/unstaged changes
2. Review the diff of the changes to understand what has been modified
3. If there are multiple logical groups of changes, consider breaking them into separate commits
4. For each commit you plan to make:
   - Stage the appropriate files
   - Write a clear, descriptive commit message following conventional commit format if applicable
   - Execute the commit

Please be thoughtful about:
- Grouping related changes together
- Writing meaningful commit messages that explain the "what" and "why"
- Not committing unrelated changes together
- Asking for confirmation before making commits if the changes seem complex

Start by showing me what changes are currently in the repository.`,
    title: 'Auto-commit workflow'
  },

  push: {
    prompt: `Please help me push my current branch to the remote repository. Here's what I'd like you to do:

1. Check the current branch and its tracking status
2. Verify there are commits to push
3. Check if the remote is up to date or if I need to pull first
4. If everything looks good, push the changes
5. If there are conflicts or issues, explain what needs to be resolved

Please be careful to:
- Warn me if this will be the first push of a new branch
- Check for any potential force-push situations
- Suggest the appropriate push command for the situation`,
    title: 'Auto-push workflow'
  },

  status: {
    prompt: `Please give me a comprehensive overview of the current state of this git repository. Include:

1. Current branch and its tracking status
2. Staged and unstaged changes with a summary of what's modified
3. Recent commit history (last 5 commits)
4. Status relative to the remote branch (ahead/behind)
5. Any stashes that exist
6. Overall assessment of the repository state

Format this in a clear, easy-to-read way that gives me a complete picture of where things stand.`,
    title: 'Repository status overview'
  }
};

program
  .name('th-git-js')
  .description('Conversational git operations using Theater')
  .option('-s, --server <address>', 'Theater server address', '127.0.0.1:9000')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--commit', 'Auto-analyze and commit changes')
  .option('--push', 'Auto-push current branch')
  .option('--status', 'Get comprehensive repository status')
  .parse();

const options = program.opts();

async function main() {
  let actorId = null;
  let theaterClient = null;

  // Determine if we're running a workflow
  const workflow = getSelectedWorkflow(options);

  // Signal handlers - let the UI cleanup handle actor stopping
  process.on('SIGINT', () => {
    log('Received SIGINT - UI will handle cleanup');
    // The UI renderApp cleanup will handle stopping the actor
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Received SIGTERM - UI will handle cleanup');
    // The UI renderApp cleanup will handle stopping the actor
    process.exit(0);
  });

  try {
    // All startup info now goes to log file only - keeps UI clean
    log('Starting Git Assistant');

    // Find git repository
    const repoPath = findGitRepository();
    log(`Found git repository: ${repoPath}`);

    // Get git context
    const gitContext = getGitContext(repoPath);
    log(`Git context: ${JSON.stringify(gitContext)}`);

    // Create Theater client
    log(`Creating Theater client for: ${options.server}`);
    theaterClient = new TheaterClient(options.server);

    // Start the chat actor
    const config = createGitConfig(repoPath, gitContext, workflow);
    log(`Created config: ${JSON.stringify(config, null, 2)}`);
    actorId = await theaterClient.startChatActor(config);
    log(`Chat actor started: ${actorId}`);

    // Render the interactive UI (with optional workflow auto-start)
    log('Starting interactive UI...');
    await renderApp(theaterClient, actorId, config, workflow);

  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    log(`ERROR: ${error.message}`, 'ERROR');
    log(`Stack trace: ${error.stack}`, 'ERROR');

    // Exit on error - cleanup will be handled by UI if it was started
    process.exit(1);
  }
}

function getSelectedWorkflow(options) {
  if (options.commit) return WORKFLOWS.commit;
  if (options.push) return WORKFLOWS.push;
  if (options.status) return WORKFLOWS.status;
  return null;
}



function createGitConfig(repoPath, gitContext, workflow) {
  const baseSystemPrompt = `You are a git agent designed to manage git operations in a repository.
You have access to git commands through the git-command tool.
You are responsible for managing branches, commits, staging, and repository inspection.

Current repository context:
Repository: ${repoPath}
Current branch: ${gitContext.branch}
Status: ${gitContext.status}

If there are no changes, or if the changes are not a complete change, or if there is any other reason not to move forward, please do not feel pressure to do so.
You can always ask the user for clarification or additional information. Do not make assumptions about what the user wants to do, only do what is obvious from the context.`;

  const workflowSystemPrompt = workflow ? `
${baseSystemPrompt}

WORKFLOW MODE: You are operating in automated workflow mode for: ${workflow.title}
The user has requested a specific workflow to be executed. Please follow the instructions provided in their message carefully and execute the requested git operations autonomously.
` : baseSystemPrompt;

  return {
    model_config: {
      model: "gemini-1.5-pro",
      provider: "google"
    },
    temperature: 1,
    max_tokens: 4096,
    system_prompt: workflowSystemPrompt,
    title: workflow ? `Git Assistant - ${workflow.title}` : `Git Assistant - ${repoPath.split('/').pop()}`,
    mcp_servers: [{
      actor: {
        manifest_path: "/Users/colinrozzi/work/actor-registry/git-mcp-actor/manifest.toml"
      }
    }],
    // Include git context for UI
    gitContext
  };
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});

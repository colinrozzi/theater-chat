# th-git-js

A conversational git assistant with inline terminal UI, powered by Theater and JavaScript.

## Features

- 🎯 **True Inline UI** - Runs in your current terminal without taking over the screen
- 🎭 **Theater Integration** - Connects to your existing Theater actor system
- 🤖 **AI-Powered** - Uses Claude for intelligent git assistance
- ⚡ **Real-time** - Live chat interface with instant responses
- 🎨 **Rich Formatting** - Beautiful colors and layout using Ink
- 🚀 **Workflow Automation** - Predefined workflows for common git operations

## Installation

```bash
cd th-git-js
bun install
```

## Usage

### Interactive Mode

Run from any git repository for interactive chat:

```bash
bun start
# or
bun src/index.js
```

### Automated Workflows

Execute common git operations with predefined prompts:

```bash
# Analyze and commit changes automatically
bun src/index.js --commit

# Push current branch to remote
bun src/index.js --push

# Get comprehensive repository status
bun src/index.js --status
```

### Command Line Options

- `--server <address>` - Theater server address (default: 127.0.0.1:9000)
- `--verbose` - Enable verbose logging
- `--commit` - Auto-analyze changes and create appropriate commits
- `--push` - Auto-push current branch with safety checks
- `--status` - Get detailed repository status overview

## Workflow Details

### `--commit` Workflow

The commit workflow will:
1. Examine current git status and changes
2. Analyze diffs to understand modifications
3. Group related changes logically
4. Create meaningful commit messages
5. Stage and commit changes appropriately
6. Ask for confirmation on complex changes

**Example:**
```bash
cd my-project
bun src/index.js --commit
```

The workflow will launch the interactive UI and automatically send the commit analysis prompt, allowing you to follow the conversation in real-time while the AI analyzes and commits your changes.

### `--push` Workflow

The push workflow will:
1. Check current branch tracking status
2. Verify commits are ready to push
3. Check for remote conflicts
4. Execute appropriate push command
5. Handle first-time branch pushes

### `--status` Workflow

The status workflow provides:
1. Current branch and tracking info
2. Staged/unstaged changes summary
3. Recent commit history
4. Remote synchronization status
5. Existing stashes
6. Overall repository health

## Interactive Mode Example

```
┌─ 🎭 Git Assistant ─────────────────────────┐
│ Repository: my-project                     │
│ Branch: feature/new-feature               │
│ Status: Working tree clean                │
│ Last commit: Add new feature              │
└───────────────────────────────────────────┘

ℹ️  🎭 Git Assistant started! Type your git-related questions or commands.

👤 You: help me commit my changes

🤖 Assistant: I'd be happy to help you commit your changes! Let me first check what files have been modified...

┌─────────────────────────────────────────────┐
│ git> _                                      │
└─────────────────────────────────────────────┘
```

## Architecture

This is a JavaScript implementation of th-git that provides the same functionality as the Rust version but with superior inline UI capabilities:

- **Ink Framework** - React-based CLI components for rich terminal UIs
- **WebSocket Client** - Direct connection to Theater server
- **Git Integration** - Repository detection and context gathering
- **Message Compatibility** - Full compatibility with existing Theater actors
- **Workflow Engine** - Predefined automation for common operations

## Development

```bash
# Install dependencies
bun install

# Run in development mode (with auto-restart)
bun run dev

# Run normally
bun start

# Test workflows
bun src/index.js --commit
bun src/index.js --status
```

## Keyboard Shortcuts (Interactive Mode)

- `Enter` - Send message
- `Ctrl+C` - Exit application
- Type `exit` or `quit` - Exit application

## Adding Custom Workflows

You can easily add new workflows by extending the `WORKFLOWS` object in `src/index.js`:

```javascript
const WORKFLOWS = {
  myworkflow: {
    prompt: `Your detailed prompt here...`,
    title: 'My Custom Workflow'
  }
};
```

Then add the corresponding CLI option:

```javascript
.option('--myworkflow', 'Description of my workflow')
```

## Next Steps

1. ✅ Implement automated workflows (--commit, --push, --status)
2. Test Theater protocol compatibility
3. Add more workflow options (--branch, --merge, --rebase)
4. Refine message parsing and error handling
5. Add configuration file support
6. Package for easy distribution

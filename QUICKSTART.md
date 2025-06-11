# Quick Start Guide

## Prerequisites

1. **Install Bun** (if not already installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Have a Theater server running** on `127.0.0.1:9000`

## Setup & Run

1. **Setup the project:**
   ```bash
   cd th-git-js
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Navigate to a git repository:**
   ```bash
   cd /path/to/your/git/repo
   ```

3. **Run th-git-js:**
   ```bash
   /path/to/th-git-js/src/index.js
   # or add to PATH and run:
   th-git-js
   ```

## What to Expect

The app will:
1. 🔍 Detect your git repository
2. 📡 Connect to Theater server
3. 🎭 Start the chat-state actor
4. 🖥️ Launch the inline terminal UI

You'll see:
- Git context header with repo info
- Chat interface for conversations
- Real-time responses from the AI assistant

## Testing the Theater Connection

The critical first step is verifying that our JavaScript client can communicate with your existing Theater server. The message protocol compatibility is key!

## Development Mode

For rapid iteration:
```bash
bun run dev
```

This enables hot reloading - any changes to the source files will automatically restart the app.

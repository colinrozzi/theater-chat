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
   cd inline-chat
   bun install
   ```

2. **Create or use a configuration file:**
   ```bash
   # Use the example config
   cp example-config.json my-config.json
   
   # Or create your own following the format in README.md
   ```

3. **Run inline-chat:**
   ```bash
   bun src/index.js --config my-config.json
   # or add to PATH and run:
   inline-chat --config my-config.json
   ```

## What to Expect

The app will:
1. 🔍 Load your chat configuration
2. 📡 Connect to Theater server
3. 🎭 Start the chat-state actor with your config
4. 🖥️ Launch the inline terminal UI

You'll see:
- Chat header with session title and model info
- Chat interface for conversations
- Real-time responses from the AI assistant
- Tool calls displayed based on your display preference

## Example Usage

```bash
# Basic chat
bun src/index.js --config example-config.json

# Start with an initial message
bun src/index.js --config example-config.json --message "Hello! Help me get started."

# Connect to different Theater server
bun src/index.js --config example-config.json --server 192.168.1.100:9000

# Verbose logging
bun src/index.js --config example-config.json --verbose
```

## Testing the Theater Connection

The critical first step is verifying that our JavaScript client can communicate with your existing Theater server. The message protocol compatibility is key!

## Development Mode

For rapid iteration:
```bash
bun run dev --config example-config.json
```

This enables hot reloading - any changes to the source files will automatically restart the app.

## Configuration Tips

1. **Start Simple**: Begin with a basic config without MCP servers
2. **Test Connection**: Verify Theater server connectivity first
3. **Add Tools**: Gradually add MCP servers for additional capabilities
4. **Customize**: Adjust system prompts and titles for your use case

# theater-chat

A configurable inline chat interface for Theater actors with rich terminal UI.

## Features

- 🎯 **True Inline UI** - Runs in your current terminal without taking over the screen
- 🎭 **Theater Integration** - Connects to your Theater actor system
- 🤖 **AI-Powered** - Works with any chat-state configuration
- ⚡ **Real-time** - Live chat interface with instant responses
- 🎨 **Rich Formatting** - Beautiful colors and layout using Ink
- ⚙️ **Configurable** - Load any chat-state configuration from JSON

## Installation

### From npm (recommended)

```bash
# Install globally
npm install -g theater-chat

# Or with bun
bun install -g theater-chat
```

### From source

```bash
git clone https://github.com/colinrozzi/theater-chat.git
cd theater-chat
bun install
bun link  # Makes theater-chat available globally
```

## Usage

### Basic Usage

Run with a configuration file:

```bash
theater-chat --config /path/to/config.json
# or during development
bun src/index.js --config ./example-config.json
```

### Command Line Options

- `--config <path>` - **Required** Path to chat configuration JSON file
- `--server <address>` - Theater server address (default: 127.0.0.1:9000)
- `--message <text>` - Send an initial message to start the conversation
- `--verbose` - Enable verbose logging

## Configuration Format

The configuration file should be a JSON file that defines the chat-state actor configuration:

```json
{
  "model_config": {
    "model": "claude-sonnet-4-20250514",
    "provider": "anthropic"
  },
  "temperature": 1.0,
  "max_tokens": 8192,
  "system_prompt": "You are a helpful assistant...",
  "title": "My Chat Session",
  "mcp_servers": [
    {
      "actor_id": null,
      "stdio": {
        "command": "/path/to/mcp-server",
        "args": ["--arg1", "value1"]
      },
      "tools": null
    }
  ]
}
```

### Required Fields

- `model_config.model` - The model to use (e.g., "claude-sonnet-4-20250514")
- `model_config.provider` - The provider (e.g., "anthropic", "openai", "google")

### Optional Fields

- `temperature` - Sampling temperature (0-2, default varies by model)
- `max_tokens` - Maximum tokens in response
- `system_prompt` - System prompt to set context
- `title` - Display title for the chat session
- `mcp_servers` - Array of MCP server configurations for tool access

## Examples

### Basic Chat with Claude

```json
{
  "model_config": {
    "model": "claude-sonnet-4-20250514",
    "provider": "anthropic"
  },
  "title": "General Chat",
  "system_prompt": "You are a helpful assistant."
}
```

### Programming Assistant with File Access

```json
{
  "model_config": {
    "model": "claude-sonnet-4-20250514",
    "provider": "anthropic"
  },
  "title": "Programming Assistant",
  "system_prompt": "You are a pair programming assistant with filesystem access.",
  "mcp_servers": [
    {
      "stdio": {
        "command": "/path/to/fs-mcp-server",
        "args": ["--allowed-dirs", "/path/to/project"]
      }
    }
  ]
}
```

### Running with Initial Message

```bash
theater-chat --config config.json --message "Hello! Can you help me review this code?"
```

## Interactive Mode

```
┌─ 🎭 Programming Assistant ─────────────────────┐
│ claude-sonnet-4-20250514                       │
│ Status: Ready                                  │
└───────────────────────────────────────────────┘

💡 Shortcuts: Ctrl+C (exit), Ctrl+L (clear), Ctrl+T (tool display), Ctrl+H (toggle help)

ℹ️  system: Type your questions or commands.

👤 You: help me understand this codebase

🤖 Assistant: I'd be happy to help you understand the codebase! Let me take a look at the project structure...

🔧 Listing directory

💬 _
```

## Architecture

This tool provides a generic inline chat interface for any Theater actor:

- **Ink Framework** - React-based CLI components for rich terminal UIs
- **WebSocket Client** - Direct connection to Theater server
- **JSON Configuration** - Flexible chat-state actor configuration
- **Message Compatibility** - Full compatibility with Theater chat protocol
- **Tool Integration** - Support for MCP servers and tool calls
- **StartChat Protocol** - Automated initialization and setup workflow

### Chat Session Flow

theater-chat now follows an enhanced startup sequence for better automation:

1. **🚀 Start Domain Actor** - Spawn the proxy actor with configuration
2. **📋 Get Chat State Actor ID** - Retrieve the underlying chat actor
3. **🤖 Start Chat Automation** - Trigger domain-specific setup (StartChat)
4. **💬 Begin Chatting** - Ready for user interaction

This flow allows proxy actors to perform automation tasks (like repository analysis, file indexing, or context setup) before the chat begins, providing users with real-time feedback during initialization.

## Development

```bash
# Install dependencies
bun install

# Run in development mode (with auto-restart)
bun run dev

# Run normally
bun start --config example-config.json

# Test with initial message
theater-chat --config example-config.json --message "Hello!"
```

## Keyboard Shortcuts

- `Enter` - Send message
- `Ctrl+C` - Exit application
- `Ctrl+L` - Clear message history
- `Ctrl+T` - Toggle tool call display (hidden/minimal/full)
- `Ctrl+H` - Toggle help text
- Type `exit` or `quit` - Exit application

## Configuration Examples

Check out `example-config.json` for a complete example configuration.

### Model Options

Different models you can use:

```json
// Claude Sonnet 4
"model_config": {
  "model": "claude-sonnet-4-20250514", 
  "provider": "anthropic"
}

// GPT-4
"model_config": {
  "model": "gpt-4", 
  "provider": "openai"
}

// Gemini Pro
"model_config": {
  "model": "gemini-1.5-pro", 
  "provider": "google"
}
```

### MCP Server Integration

Add tool capabilities via MCP servers:

```json
"mcp_servers": [
  {
    "stdio": {
      "command": "/path/to/filesystem-server",
      "args": ["--allowed-dirs", "/project"]
    }
  },
  {
    "stdio": {
      "command": "/path/to/web-search-server", 
      "args": ["--api-key", "your-key"]
    }
  }
]
```

## Next Steps

1. ✅ Basic configuration loading
2. ✅ Generic chat interface
3. ✅ Tool call display options
4. Add configuration validation and better error messages
5. Add configuration templates/presets
6. Package for easy distribution
7. Add configuration wizard

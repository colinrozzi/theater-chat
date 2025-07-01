# Theater Chat - Project Overview

This document provides a comprehensive introduction to the theater-chat project for editors and contributors.

## What is Theater Chat?

Theater Chat is an interactive terminal chat interface for Theater actor systems with AI and MCP (Model Context Protocol) tool integration. It provides a configurable, inline chat experience that runs directly in your terminal without taking over the entire screen.

## Project Details

- **Name**: theater-chat
- **Version**: 0.1.1
- **Author**: Colin Rozzi
- **License**: MIT
- **Runtime**: Bun (>=1.0.0)
- **Language**: TypeScript
- **Repository**: https://github.com/colinrozzi/theater-chat.git

## Core Features

### 🎯 True Inline UI
- Runs in your current terminal without taking over the screen
- Rich formatting and colors using the Ink framework
- Keyboard shortcuts for common actions (Ctrl+C, Ctrl+L, Ctrl+T, Ctrl+H)

### 🎭 Theater Integration
- Connects to Theater actor system via WebSocket
- Supports the full Theater chat protocol
- Automated StartChat workflow for domain-specific setup

### 🤖 AI-Powered
- Support for multiple AI providers (Anthropic, OpenAI, Google)
- Popular models: Claude Sonnet 4, GPT-4, Gemini Pro
- Configurable temperature, max tokens, and system prompts

### ⚡ Real-time Experience
- Live chat interface with instant responses
- Real-time feedback during initialization
- Streaming responses and tool call displays

### 🔧 MCP Server Integration
- Support for Model Context Protocol servers
- Tool capabilities (filesystem access, web search, etc.)
- Configurable tool display modes (hidden/minimal/full)

## Architecture Overview

### Tech Stack
- **Frontend**: React components via Ink framework
- **Runtime**: Bun for fast TypeScript execution
- **Communication**: WebSocket client for Theater server connection
- **Configuration**: JSON-based flexible configuration system
- **UI Library**: Ink (React for CLI) + supporting packages

### Key Dependencies
```json
{
  "ink": "^4.4.1",           // React-based CLI framework
  "react": "^18.2.0",        // React for component system
  "chalk": "^5.3.0",         // Terminal colors
  "commander": "^11.1.0",    // CLI argument parsing
  "theater-client": "^0.1.0", // Theater system integration
  "terminal-chat-ui": "^1.0.2" // Terminal UI components
}
```

### Project Structure
```
theater-chat/
├── src/                    # Source code
│   ├── ui/                # UI components
│   ├── config-resolver.ts # Configuration handling
│   ├── error-parser.ts    # Error handling utilities
│   ├── index.ts          # Main entry point
│   ├── theater-client.ts # Theater integration
│   └── types.ts          # TypeScript type definitions
├── configs/              # Configuration examples
├── dist/                 # Compiled output
├── test-init/           # Test/initialization files
├── package.json         # Project dependencies
├── tsconfig.json        # TypeScript configuration
└── README.md           # User documentation
```

## How It Works

### Chat Session Flow
1. **🚀 Start Domain Actor** - Spawn the proxy actor with configuration
2. **📋 Get Chat State Actor ID** - Retrieve the underlying chat actor
3. **🤖 Start Chat Automation** - Trigger domain-specific setup (StartChat)
4. **💬 Begin Chatting** - Ready for user interaction

### Configuration System
Theater Chat uses JSON configuration files that specify:
- **Actor Configuration**: Path to Theater actor manifest
- **Model Configuration**: AI provider, model, and parameters
- **System Setup**: Prompts, temperature, max tokens
- **MCP Servers**: Tool integrations and capabilities
- **UI Options**: Title, display preferences

### Example Configuration
```json
{
  "actor": {
    "manifest_path": "/path/to/chat-proxy-actor/manifest.toml"
  },
  "config": {
    "model_config": {
      "model": "claude-sonnet-4-20250514",
      "provider": "anthropic"
    },
    "title": "Programming Assistant",
    "system_prompt": "You are a helpful programming assistant.",
    "mcp_servers": [
      {
        "stdio": {
          "command": "/path/to/fs-mcp-server",
          "args": ["--allowed-dirs", "/path/to/project"]
        }
      }
    ]
  }
}
```

## Development Workflow

### Getting Started
```bash
# Install dependencies
bun install

# Run in development mode (with auto-restart)
bun run dev

# Build for production
bun run build

# Run built version
bun start --config example-config.json
```

### Available Scripts
- `bun run dev` - Development mode with file watching
- `bun run build` - Compile TypeScript to dist/
- `bun run build:watch` - Watch mode compilation
- `bun run dev:build` - Combined watch + run mode
- `bun run type-check` - TypeScript type checking

## Key Use Cases

### 1. Programming Assistant
- File system access via MCP servers
- Code review and analysis
- Project exploration and understanding

### 2. General AI Chat
- Conversational AI interface
- Configurable system prompts
- Multiple model support

### 3. Tool-Enhanced Chat
- Web search capabilities
- Database access
- Custom tool integrations

## User Interface

### Interactive Elements
- Message input with real-time typing
- Status indicators (Ready, Thinking, Error)
- Tool call displays with configurable detail levels
- Scrollable message history
- Help text and keyboard shortcuts

### Keyboard Shortcuts
- `Enter` - Send message
- `Ctrl+C` - Exit application
- `Ctrl+L` - Clear message history
- `Ctrl+T` - Toggle tool call display
- `Ctrl+H` - Toggle help text

## Integration Points

### Theater System
- WebSocket connection to Theater server (default: 127.0.0.1:9000)
- Actor lifecycle management
- Message protocol compatibility
- StartChat automation support

### MCP Servers
- Standard MCP protocol support
- Stdio-based server communication
- Tool capability discovery
- Configurable tool execution

## Future Roadmap

### Planned Features
- [ ] Configuration validation and better error messages
- [ ] Configuration templates/presets
- [ ] Configuration wizard for easy setup
- [ ] Enhanced tool display options
- [ ] Plugin system for custom integrations

### Current Status
- ✅ Basic configuration loading
- ✅ Generic chat interface  
- ✅ Tool call display options
- ✅ Theater integration
- ✅ MCP server support

## Getting Help

### Documentation
- `README.md` - User guide and installation instructions
- `QUICKSTART.md` - Quick start guide
- Configuration examples in `configs/` directory

### Development
- TypeScript types in `src/types.ts`
- Error handling patterns in `src/error-parser.ts`
- UI components in `src/ui/` directory

This project represents a sophisticated terminal-based chat interface that bridges AI capabilities with tool integrations through the Theater actor system, providing a powerful and flexible development and interaction environment.
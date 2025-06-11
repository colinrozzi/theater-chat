# Testing Guide

## Prerequisites

1. **Theater Server Running**: Make sure your Theater server is running on `127.0.0.1:9000`
2. **Valid Configuration**: Use one of the provided config files

## Test Commands

```bash
# Basic test with example config
bun src/index.js --config example-config.json

# Simple test config (no MCP servers)
bun src/index.js --config test-config.json

# With initial message
bun src/index.js --config test-config.json --message "Hello! Test message."

# Verbose logging
bun src/index.js --config test-config.json --verbose
```

## What Should Happen

1. **Connection Phase**: You should see "Connecting to Theater..." → "Opening communication channel..." → "Loading chat actor..."
2. **Ready State**: UI shows "Ready" and you can type messages
3. **Message Exchange**: Your messages should be sent and you should get responses from the AI

## Debugging

If issues occur, check these log files:
- `inline-chat.log` - Main application logs
- `theater-client.log` - Theater communication logs

## Fixed Issues

- ✅ Fixed `channel.send is not a function` - now uses `channel.sendMessage()`
- ✅ Added missing `net` import in theater.js
- ✅ Proper error handling for config loading
- ✅ Generic UI that works with any chat-state configuration

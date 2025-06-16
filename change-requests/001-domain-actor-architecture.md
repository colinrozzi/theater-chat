# Change Request 001: Domain Actor Architecture Transition

**Status:** Proposed  
**Priority:** High  
**Estimated Effort:** 2 days  
**Created:** 2025-06-16  

## Summary

Transition theater-chat from directly spawning chat-state actors to using a domain actor pattern where all interactions go through domain-specific actors that manage chat-state actors as children.

## Current Architecture

```
theater-chat → chat-state actor (direct)
```

Theater-chat directly spawns and communicates with chat-state actors using configurations that contain chat-state parameters.

## Proposed Architecture

```
User Input → theater-chat → domain actor → chat-state actor
                    ↓            ↓             ↑
                    │       AddMessage     spawns
                    │      (+ context      │
                    │       injection)     │
                    │                      │
User Display ← channel subscription ← chat-state actor
```

**Key Flow**:
1. **Message Injection**: User messages go through domain actors for context enhancement
2. **Response Streaming**: Chat responses come directly via channel subscription
3. **Domain Logic**: Domain actors inject context (git status, files, etc.) before LLM calls

Domain actors:
1. Handle domain-specific logic and context injection
2. Spawn appropriate chat-state actors
3. Return chat-state actor IDs for response streaming
4. Intercept and enhance user messages with contextual information

## Motivation

1. **Domain Logic in Theater System** - Move specialized logic (git, code review, etc.) into reusable Theater actors rather than CLI tools
2. **Reusable Actors** - Domain actors can be used by other Theater clients, not just theater-chat
3. **Cleaner Separation** - UI concerns (theater-chat) separate from domain logic (actors)
4. **Extensible Pattern** - Easy to add new domain-specific actors following the same pattern
5. **Consistent Architecture** - All interactions follow the same flow

## Breaking Changes

This is a **breaking change** that removes backward compatibility:

### Old Configuration Format (REMOVED)
```json
{
  "model_config": {
    "model": "claude-sonnet-4-20250514",
    "provider": "anthropic"
  },
  "system_prompt": "You are a helpful assistant.",
  "title": "Basic Chat"
}
```

### New Configuration Format (REQUIRED)
```json
{
  "actor": {
    "manifest_path": "/path/to/domain-actor/manifest.toml"
  },
  "config": {
    "model_config": {
      "model": "claude-sonnet-4-20250514", 
      "provider": "anthropic"
    },
    "system_prompt": "You are a helpful assistant.",
    "title": "Basic Chat"
  }
}
```

## Implementation Plan

### Phase 1: Core Changes (1 day)

#### 1.1 Update Configuration Types
**File:** `src/types.ts`

```typescript
// Replace existing types with:
export interface TheaterChatConfig {
  actor: {
    manifest_path: string;
  };
  config: any; // Domain-specific configuration
}
```

#### 1.2 Update TheaterClient
**File:** `src/theater.ts`

Add new methods:
- `startDomainActor(manifestPath: string, initialState: any): Promise<string>`
- `getChatStateActorId(domainActorId: string): Promise<string>`
- `sendMessage(domainActorId: string, message: string): Promise<void>` 
- `startChatSession(config: TheaterChatConfig): Promise<{ domainActorId: string, chatActorId: string }>`

Remove legacy methods:
- `startChatActor()` (old direct method)

**Key Change**: User messages now go through `sendMessage(domainActorId)` for context injection, while responses come via channel subscription to `chatActorId`.

#### 1.3 Update Main Application Flow
**File:** `src/index.ts`

- Simplify configuration loading (remove legacy detection)
- Use `startChatSession()` for all actor spawning
- Pass both `domainActorId` and `chatActorId` to UI

#### 1.4 Update UI Components
**File:** `src/ui.tsx`

- Accept both `domainActorId` and `chatActorId` in props
- Subscribe to `chatActorId` for receiving chat responses
- Send user messages via `sendMessage(domainActorId)` for context injection
- Update `onSendMessage` handler to use domain actor instead of direct chat-state communication

### Phase 2: Testing & Documentation (1 day)

#### 2.1 Create Default Configuration
**File:** `default-config.json`

```json
{
  "actor": {
    "manifest_path": "/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml"
  },
  "config": {
    "model_config": {
      "model": "claude-sonnet-4-20250514",
      "provider": "anthropic"
    },
    "system_prompt": "You are a helpful assistant.",
    "title": "Theater Chat"
  }
}
```

#### 2.2 Update Existing Configuration Files
Transform existing configs to new format:
- `git.json` → uses git-assistant-actor (when available)
- `sonnet.json` → uses chat-proxy-example
- `gemini-*.json` → uses chat-proxy-example

#### 2.3 Update Documentation
- README.md - new configuration format examples
- QUICKSTART.md - updated setup instructions
- Add domain actor examples

#### 2.4 Testing
- Test with chat-proxy-example actor
- Verify end-to-end message flow
- Test error handling for invalid configs
- Validate configuration loading

## Domain Actor Protocol

All domain actors must implement:

### `GetChatStateActorId` Request
```json
{
  "type": "GetChatStateActorId"
}
```

**Response:**
```json
{
  "type": "ChatStateActorId",
  "actor_id": "uuid-of-chat-state-actor"
}
```

### `AddMessage` Request (Critical)
```json
{
  "type": "AddMessage",
  "message": { /* message data */ }
}
```

**Response:**
```json
{
  "type": "Success"
}
```

**Purpose**: This is the core domain logic method. Domain actors receive user messages, inject contextual information (git status, file contents, project context), and forward enhanced messages to chat-state actors. This enables powerful context-aware AI interactions.

## Example Configurations

### Basic Chat (using chat-proxy-example)
```json
{
  "actor": {
    "manifest_path": "/Users/colinrozzi/work/actor-registry/chat-proxy-example/manifest.toml"
  },
  "config": {
    "model_config": {
      "model": "claude-sonnet-4-20250514",
      "provider": "anthropic"
    },
    "system_prompt": "You are a helpful assistant.",
    "title": "Basic Chat"
  }
}
```

### Git Assistant (future)
```json
{
  "actor": {
    "manifest_path": "/Users/colinrozzi/work/actor-registry/git-assistant-actor/manifest.toml"
  },
  "config": {
    "workflow": "commit",
    "repository_path": ".",
    "chat_config": {
      "model_config": {
        "model": "gemini-1.5-pro",
        "provider": "google"
      },
      "system_prompt": "You are a git assistant with repository context.",
      "title": "Git Assistant"
    }
  }
}
```

**Context Injection Example**: When user types "Help me write a commit message", the git-assistant-actor would enhance this to: "Help me write a commit message. Current git status: [modified files, staged changes, recent commits]"

## Migration Guide for Users

### Before (Old)
```bash
theater-chat --config old-format.json
```

### After (New)
1. Update configuration file to new format
2. Ensure chat-proxy-example actor is built and available
3. Run with new configuration:
```bash
theater-chat --config new-format.json
```

### Automated Migration Script
Consider creating a migration tool:
```bash
# Convert old config to new format
theater-chat migrate-config old.json new.json
```

## Dependencies

- **chat-proxy-example actor** - Must be built and available at expected path
- **Theater server** - No changes required
- **chat-state actor** - No changes required

## Testing Plan

### Unit Tests
- Configuration loading and validation
- TheaterClient domain actor methods
- Error handling for invalid configurations

### Integration Tests
- End-to-end actor spawning flow
- Message routing through domain actors
- Channel subscription to chat-state actors

### Manual Testing
- Basic chat functionality with chat-proxy-example
- Error scenarios (missing actors, invalid configs)
- Performance comparison with previous architecture

## Risks & Mitigation

### Risk: Breaking Existing Users
**Mitigation:** Since we're early in development, acceptable breaking change. Document migration clearly.

### Risk: chat-proxy-example Actor Unavailable
**Mitigation:** Ensure actor is built and paths are documented. Consider bundling or auto-building.

### Risk: Performance Regression
**Mitigation:** Benchmark message latency before/after. Domain actor adds minimal overhead.

### Risk: Complex Configuration
**Mitigation:** Provide clear examples and potentially a configuration generator tool.

## Success Criteria

- [ ] All existing functionality works through domain actors
- [ ] Configuration format is clean and intuitive
- [ ] Message flow performance is equivalent to current implementation
- [ ] Error handling provides clear feedback
- [ ] Documentation is updated and comprehensive
- [ ] Basic chat works with chat-proxy-example
- [ ] Ready for domain-specific actor development

## Future Enhancements

Once this change is complete, enables:
- Git assistant actors with repository context
- Code review actors with file analysis
- Documentation generation actors
- Custom domain-specific AI assistants
- Multi-actor orchestration scenarios

## Implementation Notes

- Remove all legacy code paths to keep implementation clean
- Focus on the happy path first, then add robust error handling
- Ensure logging provides visibility into the actor spawning flow
- Consider adding debug mode for troubleshooting actor issues

// Configuration types
export interface ModelConfig {
  model: string;
  provider: 'anthropic' | 'openai' | 'google';
}

export interface MCPServerStdio {
  command: string;
  args: string[];
}

export interface MCPServerActor {
  manifest_path: string;
}

export interface MCPServer {
  actor_id?: string | null;
  stdio?: MCPServerStdio;
  actor?: MCPServerActor;
  tools?: any[] | null;
}

export interface ChatConfig {
  model_config: ModelConfig;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  title?: string;
  mcp_servers?: MCPServer[];
}

// New configuration format for domain actor pattern
export interface TheaterChatConfig {
  actor: {
    manifest_path: string;
  };
  config: any; // Domain-specific configuration
}

// Theater types
export interface TheaterMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TheaterEvent {
  id: string;
  actor_id: string;
  event_type: string;
  timestamp: number;
  data: any;
  description?: string;
}

export interface ActorState {
  id: string;
  status: 'running' | 'stopped' | 'error';
  manifest?: any;
  [key: string]: any;
}

// UI types
export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: Date;
  tools?: any[];
  status?: 'pending' | 'complete';
  toolName?: string;
  toolArgs?: string[];
}

export type SetupStatus = 'connecting' | 'opening_channel' | 'loading_actor' | 'ready' | 'error';
export type ToolDisplayMode = 'hidden' | 'minimal' | 'full';
export type InputMode = 'insert' | 'command';

export interface MultiLineInputProps {
  placeholder?: string;
  onSubmit: (content: string) => void;
  maxHeight?: number;
  mode?: 'insert' | 'command';
  onModeChange?: (mode: 'insert' | 'command') => void;
  content?: string;
  cursorPosition?: number;
  onContentChange?: (content: string) => void;
  onCursorChange?: (position: number) => void;
}

export interface AppState {
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  error?: string;
  domainActorId?: string;
  chatActorId?: string;
  config: TheaterChatConfig;
  toolDisplayMode: ToolDisplayMode;
  showHelp: boolean;
}

export interface UIProps {
  state: AppState;
  onSendMessage: (message: string) => void;
  onExit: () => void;
  onClear: () => void;
  onToggleToolDisplay: () => void;
  onToggleHelp: () => void;
}

// CLI types
export interface CLIOptions {
  config: string;
  server: string;
  verbose: boolean;
  message?: string;
}

export interface ConfigListOptions {
  global: boolean;
  all: boolean;
}

export interface ConfigInitOptions {
  global: boolean;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  data?: any;
  [key: string]: any;
}

export interface ChannelMessage extends WSMessage {
  channel_id: string;
  message: any;
}

export interface RequestMessage extends WSMessage {
  actor_id: string;
  data: any;
}

// Theater types
export interface ChannelStream {
  channelId: string;
  onMessage(handler: (message: any) => void): () => void;
  sendMessage(message: string): Promise<void>;
  close(): void;
}

// Re-export TheaterClient from theater module
export { TheaterClient } from './theater.js';

// Tool types
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  id: string;
  result: any;
  error?: string;
}

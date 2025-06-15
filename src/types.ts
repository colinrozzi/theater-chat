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
export interface AppState {
  messages: TheaterMessage[];
  isConnected: boolean;
  isLoading: boolean;
  error?: string;
  actorId?: string;
  config: ChatConfig;
  toolDisplayMode: 'hidden' | 'minimal' | 'full';
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

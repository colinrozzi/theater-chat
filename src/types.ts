/**
 * Type definitions for git-agent
 */

// Re-export shared types from terminal-chat-ui
export type {
  Message,
  SetupStatus,
  ToolDisplayMode,
  ChatSession
} from 'terminal-chat-ui';
import { z } from 'zod';

export type ExecutionMode = 'task' | 'interactive';

export type ChatConfig = z.infer<typeof ChatConfigSchema>;
/*
export interface ChatConfig {
  actor: {
    manifest_path: string;
    initial_state?: ChatProxyInitialState;
  };
}
*/
export const ChatConfigSchema = z.object({
  actor: z.object({
    manifest_path: z.string(),
    initial_state: z.any().optional(), // Allow any structure for saved sessions and flexible configs
  }),
});


export interface ChatProxyInitialState {
  // Core task definition
  system_prompt?: string;
  initial_message?: string;

  // AI configuration  
  model_config?: {
    model: string;
    provider: string;
  };
  temperature?: number;
  max_tokens?: number;

  // Tool configuration
  mcp_servers?: Array<{
    actor_id?: string | null;
    actor?: {
      manifest_path: string;
      init_state?: any;
    };
    tools?: any;
  }>;
}

export interface CLIOptions {
  directory?: string;
  server?: string;
  mode?: ExecutionMode;
  message?: string;
  verbose?: boolean;
  help?: boolean;
}

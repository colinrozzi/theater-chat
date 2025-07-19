/**
 * Theater client wrapper for git workflows using task-manager
 */

import { TheaterClient, Actor, ChannelStream, setLogLevel } from 'theater-client';
import type { ChatConfig, ChatSession } from './types.js';

// Enhanced error handling for connection issues
interface OperationContext {
  operation: string;
  actor?: string | undefined;
  details?: any;
  timestamp: number;
}

class ConnectionError extends Error {
  constructor(
    public originalError: Error,
    public context: OperationContext
  ) {
    const contextMessage = `${context.operation}${context.actor ? ` (actor: ${context.actor})` : ''}`;
    super(`Connection failed during: ${contextMessage}\nOriginal error: ${originalError.message}`);
    this.name = 'ConnectionError';
  }
}

// Enhanced wrapper for actor operations
async function withConnectionContext<T>(
  operation: string,
  actorId: string | undefined,
  details: any,
  asyncOperation: () => Promise<T>
): Promise<T> {
  const context: OperationContext = {
    operation,
    actor: actorId,
    details,
    timestamp: Date.now()
  };

  try {
    return await asyncOperation();
  } catch (error) {
    if (error instanceof Error) {
      // Check if this looks like a connection error
      if (isConnectionError(error)) {
        throw new ConnectionError(error, context);
      }
    }
    throw error;
  }
}

function isConnectionError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('connection closed') ||
    message.includes('connection refused') ||
    message.includes('websocket') ||
    message.includes('econnrefused') ||
    message.includes('network error')
  );
}

// Enhanced error formatting for UI
export function formatConnectionError(error: any): string {
  if (error instanceof ConnectionError) {
    const timeStr = new Date(error.context.timestamp).toLocaleTimeString();
    let message = `Connection lost at ${timeStr} while: ${error.context.operation}`;

    if (error.context.actor) {
      message += `\nActor: ${error.context.actor}`;
    }

    if (error.context.details) {
      const details = JSON.stringify(error.context.details, null, 2);
      message += `\nOperation details: ${details}`;
    }

    message += `\nUnderlying error: ${error.originalError.message}`;

    // Add helpful suggestions
    message += '\n\nThis usually means:';
    message += '\n• The Theater server closed the connection unexpectedly';
    message += '\n• The actor completed and shut down during the operation';
    message += '\n• Network connectivity was lost';

    return message;
  }

  // Fall back to original error formatting
  return error instanceof Error ? error.message : String(error);
}

// New type for actor lifecycle callbacks
export interface ActorLifecycleCallbacks {
  onActorExit?: (result: any) => void;
  onActorError?: (error: any) => void;
  onActorEvent?: (event: any) => void;
}

export class TheaterChatClient {
  private client: TheaterClient;

  constructor(serverAddress: string, verbose: boolean = false) {
    if (verbose) {
      setLogLevel('info');
    } else {
      setLogLevel('error');
    }

    const [host, port] = serverAddress.split(':');
    this.client = new TheaterClient(
      host || '127.0.0.1',
      parseInt(port || '9000') || 9000,
      {
        timeout: 0, // No timeout for interactive chat sessions
        retryAttempts: 3,
        retryDelay: 1000
      }
    );
  }

  /**
   * Start a domain actor with lifecycle callbacks
   */
  async startDomainActor(
    manifestPath: string,
    initialState: any = {},
    callbacks?: ActorLifecycleCallbacks
  ): Promise<Actor> {
    const actor = await this.client.startActor({
      manifest: manifestPath,
      initialState: new TextEncoder().encode(JSON.stringify(initialState)),
      onEvent: (event) => {
        // Call user-provided event callback if provided
        if (callbacks?.onActorEvent) {
          callbacks.onActorEvent(event);
        }
      },
      onError: (error) => {
        // Call user-provided error callback
        if (callbacks?.onActorError) {
          callbacks.onActorError(error);
        }
      },
      onActorResult: (result) => {
        // This gets called when the actor exits/completes
        // Call user-provided exit callback
        if (callbacks?.onActorExit) {
          callbacks.onActorExit(result);
        }
      }
    });

    return actor;
  }

  /**
   * Get the chat state actor ID from a task-manager actor
   */
  async getChatStateActorId(taskManagerActor: Actor): Promise<string> {
    return withConnectionContext(
      'Getting chat state actor ID',
      taskManagerActor.id,
      { request: { type: 'GetChatStateActorId' } },
      async () => {
        const response = await taskManagerActor.requestJson({
          type: 'GetChatStateActorId'
        });

        if (response.type !== 'ChatStateActorId' || !response.actor_id) {
          throw new Error(`Invalid response from task-manager: ${JSON.stringify(response)}`);
        }

        return response.actor_id;
      }
    );
  }

  async startSession(config: ChatConfig, callbacks?: ActorLifecycleCallbacks): Promise<ChatSession> {
    const taskManagerActor = await this.client.startActor({
      manifest: config.actor.manifest_path,
      initialState: new TextEncoder().encode(JSON.stringify(config.actor.initial_state)),
      onEvent: (event) => {
        if (callbacks?.onActorEvent) {
          callbacks.onActorEvent(event);
        }
      },
      onError: (error) => {
        if (callbacks?.onActorError) {
          callbacks.onActorError(error);
        }
      },
      onActorResult: (result) => {
        if (result.type === 'Error') {
          if (callbacks?.onActorError) {
            callbacks.onActorError(result.error);
          }
        } else {
          if (callbacks?.onActorExit) {
            callbacks.onActorExit(result);
          }
        }
      }
    });

    // Get chat-state actor ID from task-manager
    const chatStateResponse = await taskManagerActor.requestJson({
      type: 'GetChatStateActorId'
    });

    if (chatStateResponse.type !== 'ChatStateActorId' || !chatStateResponse.actor_id) {
      throw new Error(`Invalid response from task-manager: ${JSON.stringify(chatStateResponse)}`);
    }

    const chatActorId = chatStateResponse.actor_id;

    return {
      domainActor: taskManagerActor,
      chatActorId
    };
  }

  /**
   * Start the git workflow automation using task-manager
   */
  async startWorkflow(taskManagerActor: Actor): Promise<void> {
    return withConnectionContext(
      'Starting chat workflow',
      taskManagerActor.id,
      { request: { type: 'StartChat' } },
      async () => {
        const response = await taskManagerActor.requestJson({
          type: 'StartChat'
        });

        if (response.type === 'Success') {
          return;
        } else if (response.type === 'Error') {
          throw new Error(`Failed to start git workflow: ${response.message}`);
        } else {
          throw new Error(`Invalid response from task-manager: ${JSON.stringify(response)}`);
        }
      }
    );
  }

  /**
   * Send a message through the task-manager actor
   */
  async sendMessage(taskManagerActor: Actor, message: string): Promise<void> {
    return withConnectionContext(
      'Sending chat message',
      taskManagerActor.id,
      { message: message.slice(0, 50) + (message.length > 50 ? '...' : '') },
      async () => {
        const messageData = {
          type: 'AddMessage',
          message: {
            role: 'User',
            content: [{ 'Text': message }]
          }
        };

        const response = await taskManagerActor.requestJson(messageData);

        if (response.type !== 'Success') {
          throw new Error(`Task manager rejected message: ${JSON.stringify(response)}`);
        }
      }
    );
  }

  /**
   * Open a channel stream to the chat actor
   */
  async openChannelStream(chatActorId: string): Promise<ChannelStream> {
    return withConnectionContext(
      'Opening channel stream',
      chatActorId,
      { target: 'chat-actor' },
      async () => {
        return await this.client.openChannel({ Actor: chatActorId });
      }
    );
  }

  /**
   * Stop an actor
   */
  async stopActor(actor: Actor): Promise<void> {
    await actor.stop();
  }

  /**
   * Get an actor instance by ID for making requests
   */
  async getActorById(actorId: string): Promise<Actor> {
    // Create an Actor wrapper for an existing actor ID
    return new Actor(actorId, this.client);
  }

  /**
   * Get raw theater client
   */
  getRawClient(): TheaterClient {
    return this.client;
  }
}

import { EventEmitter } from 'node:events';
import net from 'node:net';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ChatConfig, TheaterChatConfig, TheaterMessage, WSMessage } from './types.js';

// Logging utility
const logFile = path.join(process.cwd(), 'theater-client.log');
function log(message: string, level: string = 'INFO'): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}\n`;
  // Don't console.log when UI is running - interferes with Ink
  fs.appendFileSync(logFile, logMessage);
}
fs.writeFileSync(logFile, `=== Theater Client started at ${new Date().toISOString()} ===\n`);

interface FrameMessage {
  Complete?: number[];
  Fragment?: any;
}

interface ManagementCommand {
  [key: string]: any;
}

interface ActorStartResponse {
  ActorStarted?: { id: string };
  Error?: any;
}

interface ChannelResponse {
  ChannelOpened?: { channel_id: string };
  ChannelMessage?: {
    sender_id: string;
    message: number[];
  };
  ChannelClosed?: any;
  Error?: any;
}

interface ActorListResponse {
  ActorList?: { actors: any[] };
  Error?: any;
}

interface ActorStatusResponse {
  ActorStatus?: { status: any };
  Error?: any;
}

interface ActorStoppedResponse {
  ActorStopped?: any;
  Error?: any;
}

interface RequestResponse {
  RequestResponse?: {
    data: number[];
  };
  Error?: any;
}

interface RequestedMessage {
  RequestedMessage?: {
    id: string;
    message: number[];
  };
  Error?: any;
}

type TheaterResponse = ActorStartResponse | ChannelResponse | ActorListResponse | ActorStatusResponse | ActorStoppedResponse | RequestResponse | RequestedMessage;

/**
 * A single connection to the Theater server
 * Each connection is dedicated to a specific operation to avoid response multiplexing
 */
export class TheaterConnection extends EventEmitter {
  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  private dataBuffer: Buffer = Buffer.alloc(0);
  public connected: boolean = false;

  constructor(host: string, port: number) {
    super();
    this.host = host;
    this.port = port;

    // Prevent EventTarget memory leak warnings
    this.setMaxListeners(20);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();

      this.socket.connect(this.port, this.host, () => {
        this.connected = true;
        resolve();
      });

      this.socket.on('error', (error) => {
        this.connected = false;
        reject(new Error(`TCP connection failed: ${error.message}`));
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.emit('disconnect');
      });
    });
  }

  private handleData(data: Buffer): void {
    // Accumulate data in buffer
    if (!this.dataBuffer) {
      this.dataBuffer = Buffer.alloc(0);
    }
    this.dataBuffer = Buffer.concat([this.dataBuffer, data]);

    // Try to parse length-delimited messages
    while (this.dataBuffer.length >= 4) {
      // Read the length prefix (4 bytes, big-endian)
      const messageLength = this.dataBuffer.readUInt32BE(0);

      // Check if we have the complete message
      if (this.dataBuffer.length >= 4 + messageLength) {
        // Extract the message
        const messageBytes = this.dataBuffer.subarray(4, 4 + messageLength);

        // Remove processed data from buffer
        this.dataBuffer = this.dataBuffer.subarray(4 + messageLength);

        try {
          const messageStr = messageBytes.toString('utf8');
          const frameMessage: FrameMessage = JSON.parse(messageStr);

          // Unwrap FragmentingCodec format
          let actualMessage: TheaterResponse;
          if (frameMessage.Complete) {
            // FrameType::Complete - convert byte array back to JSON
            const messageBytes = Buffer.from(frameMessage.Complete);
            actualMessage = JSON.parse(messageBytes.toString('utf8'));
          } else if (frameMessage.Fragment) {
            // FrameType::Fragment - for now, we don't expect large responses
            // In a full implementation, we'd reassemble fragments
            this.emit('error', new Error('Fragment messages not yet supported'));
            return;
          } else {
            // Unknown frame type
            this.emit('error', new Error(`Unknown frame type: ${JSON.stringify(frameMessage)}`));
            return;
          }

          this.emit('message', actualMessage);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.emit('error', new Error(`Failed to parse message: ${errorMessage}`));
        }
      } else {
        // Not enough data for complete message, wait for more
        break;
      }
    }
  }

  async send(command: string, data: any = {}): Promise<void> {
    if (!this.connected || !this.socket) {
      throw new Error('Connection not established');
    }

    // Structure the command exactly like the Rust ManagementCommand enum
    const commandMessage: ManagementCommand = {
      [command]: data
    };

    // Convert to bytes
    const commandBytes = Buffer.from(JSON.stringify(commandMessage), 'utf8');

    // Wrap in FragmentingCodec format (FrameType::Complete for small messages)
    const frameMessage: FrameMessage = {
      Complete: Array.from(commandBytes)
    };

    // Send as length-delimited JSON (matching FragmentingCodec)
    const messageStr = JSON.stringify(frameMessage);
    const messageBytes = Buffer.from(messageStr, 'utf8');
    const lengthPrefix = Buffer.allocUnsafe(4);
    lengthPrefix.writeUInt32BE(messageBytes.length, 0);

    this.socket.write(Buffer.concat([lengthPrefix, messageBytes]));
  }

  async receive(): Promise<TheaterResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Receive timeout'));
      }, 300000); // 5 minutes

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('message', onMessage);
        this.removeListener('error', onError);
        this.removeListener('disconnect', onDisconnect);
      };

      const onMessage = (message: TheaterResponse) => {
        cleanup();
        resolve(message);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onDisconnect = () => {
        cleanup();
        reject(new Error('Connection closed'));
      };

      // Use once() instead of on() to automatically remove listeners after first event
      this.once('message', onMessage);
      this.once('error', onError);
      this.once('disconnect', onDisconnect);
    });
  }

  close(): void {
    if (this.socket) {
      this.socket.end();
    }
  }
}

interface ChannelMessageHandler {
  (message: { sender_id: string; message: number[] }): void;
}

interface ChannelStream {
  channelId: string;
  onMessage(handler: ChannelMessageHandler): () => void;
  sendMessage(message: string): Promise<void>;
  close(): void;
}

/**
 * Theater client that manages multiple connections using the hygiene pattern
 * Each operation gets its own connection to avoid response multiplexing
 */
export class TheaterClient {
  private host: string;
  private port: number;
  private activeTasks: Set<any> = new Set();

  constructor(serverAddress: string) {
    const [host, port] = serverAddress.split(':');
    this.host = host || 'localhost';
    this.port = parseInt(port || '9000') || 9000;
  }

  /**
   * Create a new connection for a specific operation
   */
  private async createConnection(): Promise<TheaterConnection> {
    const connection = new TheaterConnection(this.host!, this.port);
    await connection.connect();
    return connection;
  }

  /**
   * Start a domain actor and return its ID
   */
  async startDomainActor(manifestPath: string, initialState: any): Promise<string> {
    log(`Starting domain actor with manifest: ${manifestPath}`);
    const connection = await this.createConnection();
    log('Connection created for startDomainActor');

    try {
      await connection.send('StartActor', {
        manifest: manifestPath,
        initial_state: Array.from(Buffer.from(JSON.stringify(initialState), 'utf8')),
        parent: false,
        subscribe: false
      });

      // Wait for response
      while (true) {
        const response = await connection.receive();

        if ('ActorStarted' in response && response.ActorStarted) {
          log(`Domain actor started: ${response.ActorStarted.id}`);
          return response.ActorStarted.id;
        } else if ('Error' in response && response.Error) {
          throw new Error(`Failed to start domain actor: ${JSON.stringify(response.Error)}`);
        }
        // Ignore other responses
      }
    } finally {
      connection.close();
    }
  }

  /**
   * Get the chat-state actor ID from a domain actor
   */
  async getChatStateActorId(domainActorId: string): Promise<string> {
    log(`Getting chat-state actor ID from domain actor: ${domainActorId}`);
    const connection = await this.createConnection();
    log('Connection created for getChatStateActorId');

    try {
      await connection.send('RequestActorMessage', {
        id: domainActorId,
        data: Array.from(Buffer.from(JSON.stringify({ type: 'GetChatStateActorId' }), 'utf8'))
      });

      // Wait for response
      while (true) {
        const response = await connection.receive();
        log(`getChatStateActorId response: ${JSON.stringify(response)}`);

        if ('RequestedMessage' in response && response.RequestedMessage) {
          const responseData = Buffer.from(response.RequestedMessage.message).toString('utf8');
          const parsedResponse = JSON.parse(responseData);

          if (parsedResponse.type === 'ChatStateActorId' && parsedResponse.actor_id) {
            log(`Got chat-state actor ID: ${parsedResponse.actor_id}`);
            return parsedResponse.actor_id;
          } else {
            throw new Error(`Invalid response from domain actor: ${responseData}`);
          }
        } else if ('Error' in response && response.Error) {
          throw new Error(`Failed to get chat-state actor ID: ${JSON.stringify(response.Error)}`);
        }
        // Ignore other responses
      }
    } finally {
      connection.close();
    }
  }

  /**
   * Send a message through the domain actor for context injection
   */
  async sendMessage(domainActorId: string, message: string): Promise<void> {
    log(`Sending message through domain actor: ${domainActorId}`);
    const connection = await this.createConnection();
    log('Connection created for sendMessage');

    try {
      const messageData = {
        type: 'AddMessage',
        message: {
          role: 'user',
          content: message,
          timestamp: Date.now()
        }
      };

      await connection.send('RequestActorMessage', {
        id: domainActorId,
        data: Array.from(Buffer.from(JSON.stringify(messageData), 'utf8'))
      });

      // Wait for response
      while (true) {
        const response = await connection.receive();
        log(`sendMessage response: ${JSON.stringify(response)}`);

        if ('RequestedMessage' in response && response.RequestedMessage) {
          const responseData = Buffer.from(response.RequestedMessage.message).toString('utf8');
          const parsedResponse = JSON.parse(responseData);

          if (parsedResponse.type === 'Success') {
            log('Message sent successfully through domain actor');
            return;
          } else {
            throw new Error(`Domain actor rejected message: ${responseData}`);
          }
        } else if ('Error' in response && response.Error) {
          throw new Error(`Failed to send message through domain actor: ${JSON.stringify(response.Error)}`);
        }
        // Ignore other responses
      }
    } finally {
      connection.close();
    }
  }

  /**
   * Start a complete chat session with domain actor pattern
   */
  async startChatSession(config: TheaterChatConfig): Promise<{ domainActorId: string, chatActorId: string }> {
    log('Starting chat session with domain actor pattern');

    // Start domain actor
    const domainActorId = await this.startDomainActor(config.actor.manifest_path, config.config);

    // Get chat-state actor ID
    const chatActorId = await this.getChatStateActorId(domainActorId);

    log(`Chat session started - Domain: ${domainActorId}, Chat: ${chatActorId}`);
    return { domainActorId, chatActorId };
  }

  /**
   * Legacy method - Start an actor and return its ID
   * @deprecated Use startChatSession instead
   */
  async startChatActor(config: ChatConfig): Promise<string> {
    log('Starting chat actor...');
    const connection = await this.createConnection();
    log('Connection created for startChatActor');

    try {
      const conversationId = uuidv4();
      log(`Generated conversation ID: ${conversationId}`);
      const manifestPath = "/Users/colinrozzi/work/actor-registry/chat-state/manifest.toml";

      const initialState = {
        conversation_id: conversationId,
        config
      };

      await connection.send('StartActor', {
        manifest: manifestPath,
        initial_state: Array.from(Buffer.from(JSON.stringify(initialState), 'utf8')),
        parent: false,
        subscribe: false
      });

      // Wait for response
      while (true) {
        const response = await connection.receive();

        if ('ActorStarted' in response && response.ActorStarted) {
          return response.ActorStarted.id;
        } else if ('Error' in response && response.Error) {
          throw new Error(`Failed to start actor: ${JSON.stringify(response.Error)}`);
        }
        // Ignore other responses
      }
    } finally {
      connection.close();
    }
  }

  /**
   * Open a channel and return a message stream
   */
  async openChannelStream(actorId: string): Promise<ChannelStream> {
    const connection = await this.createConnection();
    const messageHandlers = new Set<ChannelMessageHandler>();
    let channelId: string | null = null;
    const self = this; // Capture reference to TheaterClient
    const targetActorId = actorId; // Capture actorId for use in sendMessage

    // Send open channel command
    await connection.send('OpenChannel', {
      actor_id: { Actor: actorId },
      initial_message: []
    });

    // Start continuous message listening
    const startMessageListener = async (): Promise<void> => {
      log('Starting message listener loop');
      try {
        while (true) {
          log('Waiting for next message...');
          const message = await connection.receive();
          log(`Received message: ${JSON.stringify(message)}`);

          if ('ChannelOpened' in message && message.ChannelOpened) {
            channelId = message.ChannelOpened.channel_id;
            log(`Channel opened: ${channelId}`);
          } else if ('ChannelMessage' in message && message.ChannelMessage) {
            log(`Received channel message from ${message.ChannelMessage.sender_id}, length: ${message.ChannelMessage.message.length}`);
            const fullMessageText = Buffer.from(message.ChannelMessage.message).toString('utf8');
            log(`Full message content: ${fullMessageText}`);
            // Notify all registered handlers
            log(`Notifying ${messageHandlers.size} message handlers`);
            for (const handler of messageHandlers) {
              try {
                handler(message.ChannelMessage);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log(`Error in message handler: ${errorMessage}`, 'ERROR');
              }
            }
          } else if ('ChannelClosed' in message && message.ChannelClosed) {
            log('Channel closed');
            break;
          } else if ('Error' in message && message.Error) {
            log(`Channel error: ${JSON.stringify(message.Error)}`, 'ERROR');
            break;
          } else {
            log(`Unknown message type: ${JSON.stringify(message)}`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Message listener error: ${errorMessage}`, 'ERROR');
      }
    };

    // Start the message listener in the background with restart capability
    const startListener = async (): Promise<void> => {
      while (true) {
        try {
          await startMessageListener();
          log('Message listener ended, restarting in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log(`Failed to restart message listener: ${errorMessage}`, 'ERROR');
          break;
        }
      }
    };
    startListener();

    // Wait for channel to open
    let retries = 0;
    while (!channelId && retries < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!channelId) {
      connection.close();
      throw new Error('Channel failed to open within timeout');
    }

    // Return channel interface
    return {
      channelId,

      // Add message handler
      onMessage(handler: ChannelMessageHandler): () => void {
        log(`Adding message handler, total handlers: ${messageHandlers.size + 1}`);
        messageHandlers.add(handler);
        return () => {
          log(`Removing message handler, remaining: ${messageHandlers.size - 1}`);
          messageHandlers.delete(handler);
        };
      },

      // Send message on this channel
      async sendMessage(message: string): Promise<void> {
        log(`Sending message: ${message}`);
        const sendConnection = await self.createConnection();
        try {
          // First, send the AddMessage request
          const addMessageRequest = {
            type: 'add_message',
            message: {
              role: 'user',
              content: [{
                type: 'text',
                text: message
              }]
            }
          };
          log(`Sending AddMessage request: ${JSON.stringify(addMessageRequest)}`);

          await sendConnection.send('RequestActorMessage', {
            id: targetActorId,
            data: Array.from(Buffer.from(JSON.stringify(addMessageRequest), 'utf8'))
          });

          const addResponse = await sendConnection.receive();
          log(`AddMessage response: ${JSON.stringify(addResponse)}`);
          if ('Error' in addResponse && addResponse.Error) {
            throw new Error(`Failed to add message: ${JSON.stringify(addResponse.Error)}`);
          }

          // Then trigger a completion
          const generateRequest = {
            type: 'generate_completion'
          };
          log(`Sending GenerateCompletion request: ${JSON.stringify(generateRequest)}`);

          await sendConnection.send('RequestActorMessage', {
            id: targetActorId,
            data: Array.from(Buffer.from(JSON.stringify(generateRequest), 'utf8'))
          });

          const generateResponse = await sendConnection.receive();
          log(`GenerateCompletion response: ${JSON.stringify(generateResponse)}`);
          if ('Error' in generateResponse && generateResponse.Error) {
            throw new Error(`Failed to generate completion: ${JSON.stringify(generateResponse.Error)}`);
          }
          log('Message send completed successfully');
        } finally {
          sendConnection.close();
        }
      },

      // Close the channel
      close(): void {
        connection.close();
      }
    };
  }

  /**
   * Send a message to an actor (one-shot operation)
   */
  async sendActorMessage(actorId: string, message: string): Promise<void> {
    const connection = await this.createConnection();

    try {
      // Structure message for chat actor
      const messageObj = {
        role: "user",
        content: [{ text: message }]
      };

      const addMessageRequest = {
        type: "add_message",
        message: messageObj
      };

      const generateRequest = {
        type: "generate_completion"
      };

      // Send add message request
      await connection.send('RequestActorMessage', {
        id: actorId,
        data: Array.from(Buffer.from(JSON.stringify(addMessageRequest), 'utf8'))
      });

      // Wait for response
      await connection.receive();

      // Send generate request
      await connection.send('RequestActorMessage', {
        id: actorId,
        data: Array.from(Buffer.from(JSON.stringify(generateRequest), 'utf8'))
      });

      // Wait for response
      const response = await connection.receive();

      if ('Error' in response && response.Error) {
        throw new Error(`Actor message failed: ${JSON.stringify(response.Error)}`);
      }

    } finally {
      connection.close();
    }
  }

  /**
   * List all actors (one-shot operation)
   */
  async listActors(): Promise<any[]> {
    const connection = await this.createConnection();

    try {
      await connection.send('ListActors', {});

      const response = await connection.receive();

      if ('ActorList' in response && response.ActorList) {
        return response.ActorList.actors;
      } else if ('Error' in response && response.Error) {
        throw new Error(`Failed to list actors: ${JSON.stringify(response.Error)}`);
      }

      throw new Error('Unexpected response to ListActors');
    } finally {
      connection.close();
    }
  }

  /**
   * Get actor status (one-shot operation)
   */
  async getActorStatus(actorId: string): Promise<any> {
    const connection = await this.createConnection();

    try {
      await connection.send('GetActorStatus', {
        id: actorId
      });

      const response = await connection.receive();

      if ('ActorStatus' in response && response.ActorStatus) {
        return response.ActorStatus.status;
      } else if ('Error' in response && response.Error) {
        throw new Error(`Failed to get actor status: ${JSON.stringify(response.Error)}`);
      }

      throw new Error('Unexpected response to GetActorStatus');
    } finally {
      connection.close();
    }
  }

  /**
   * Stop an actor (one-shot operation)
   */
  async stopActor(actorId: string): Promise<boolean> {
    const connection = await this.createConnection();

    try {
      await connection.send('StopActor', {
        id: actorId
      });

      const response = await connection.receive();

      if ('ActorStopped' in response && response.ActorStopped) {
        return true;
      } else if ('Error' in response && response.Error) {
        throw new Error(`Failed to stop actor: ${JSON.stringify(response.Error)}`);
      }

      return false;
    } finally {
      connection.close();
    }
  }
}

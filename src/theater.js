import net from 'net';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'node:events';
import fs from 'fs';
import path from 'path';

// Logging utility
const logFile = path.join(process.cwd(), 'theater-client.log');
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}\n`;
  // Don't console.log when UI is running - interferes with Ink
  fs.appendFileSync(logFile, logMessage);
}
fs.writeFileSync(logFile, `=== Theater Client started at ${new Date().toISOString()} ===\n`);

/**
 * A single connection to the Theater server
 * Each connection is dedicated to a specific operation to avoid response multiplexing
 */
export class TheaterConnection extends EventEmitter {
  constructor(host, port) {
    super();
    this.host = host;
    this.port = port;
    this.socket = null;
    this.dataBuffer = Buffer.alloc(0);
    this.connected = false;
    
    // Prevent EventTarget memory leak warnings
    this.setMaxListeners(20);
  }

  async connect() {
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

  handleData(data) {
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
          const frameMessage = JSON.parse(messageStr);

          // Unwrap FragmentingCodec format
          let actualMessage;
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
          this.emit('error', new Error(`Failed to parse message: ${error.message}`));
        }
      } else {
        // Not enough data for complete message, wait for more
        break;
      }
    }
  }

  async send(command, data = {}) {
    if (!this.connected) {
      throw new Error('Connection not established');
    }

    // Structure the command exactly like the Rust ManagementCommand enum
    const commandMessage = {
      [command]: data
    };

    // Convert to bytes
    const commandBytes = Buffer.from(JSON.stringify(commandMessage), 'utf8');

    // Wrap in FragmentingCodec format (FrameType::Complete for small messages)
    const frameMessage = {
      Complete: Array.from(commandBytes)
    };

    // Send as length-delimited JSON (matching FragmentingCodec)
    const messageStr = JSON.stringify(frameMessage);
    const messageBytes = Buffer.from(messageStr, 'utf8');
    const lengthPrefix = Buffer.allocUnsafe(4);
    lengthPrefix.writeUInt32BE(messageBytes.length, 0);

    this.socket.write(Buffer.concat([lengthPrefix, messageBytes]));
  }

  async receive() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Receive timeout'));
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('message', onMessage);
        this.removeListener('error', onError);
        this.removeListener('disconnect', onDisconnect);
      };

      const onMessage = (message) => {
        cleanup();
        resolve(message);
      };

      const onError = (error) => {
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

  close() {
    if (this.socket) {
      this.socket.end();
    }
  }
}

/**
 * Theater client that manages multiple connections using the hygiene pattern
 * Each operation gets its own connection to avoid response multiplexing
 */
export class TheaterClient {
  constructor(serverAddress) {
    const [host, port] = serverAddress.split(':');
    this.host = host;
    this.port = parseInt(port);
    this.activeTasks = new Set();
  }

  /**
   * Create a new connection for a specific operation
   */
  async createConnection() {
    const connection = new TheaterConnection(this.host, this.port);
    await connection.connect();
    return connection;
  }

  /**
   * Start an actor and return its ID
   */
  async startChatActor(config) {
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

        if (response.ActorStarted) {
          return response.ActorStarted.id;
        } else if (response.Error) {
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
  async openChannelStream(actorId) {
    const connection = await this.createConnection();
    const messageHandlers = new Set();
    let channelId = null;
    const self = this; // Capture reference to TheaterClient
    const targetActorId = actorId; // Capture actorId for use in sendMessage

    // Send open channel command
    await connection.send('OpenChannel', {
      actor_id: { Actor: actorId },
      initial_message: []
    });

    // Start continuous message listening
    const startMessageListener = async () => {
      log('Starting message listener loop');
      try {
        while (true) {
          log('Waiting for next message...');
          const message = await connection.receive();
          log(`Received message: ${JSON.stringify(message)}`);

          if (message.ChannelOpened) {
            channelId = message.ChannelOpened.channel_id;
            log(`Channel opened: ${channelId}`);
          } else if (message.ChannelMessage) {
            log(`Received channel message from ${message.ChannelMessage.sender_id}, length: ${message.ChannelMessage.message.length}`);
            const fullMessageText = Buffer.from(message.ChannelMessage.message).toString('utf8');
            log(`Full message content: ${fullMessageText}`);
            // Notify all registered handlers
            log(`Notifying ${messageHandlers.size} message handlers`);
            for (const handler of messageHandlers) {
              try {
                handler(message.ChannelMessage);
              } catch (error) {
                log(`Error in message handler: ${error.message}`, 'ERROR');
              }
            }
          } else if (message.ChannelClosed) {
            log('Channel closed');
            break;
          } else if (message.Error) {
            log(`Channel error: ${JSON.stringify(message.Error)}`, 'ERROR');
            break;
          } else {
            log(`Unknown message type: ${JSON.stringify(message)}`);
          }
        }
      } catch (error) {
        log(`Message listener error: ${error.message}`, 'ERROR');
      }
    };

    // Start the message listener in the background with restart capability
    const startListener = async () => {
      while (true) {
        try {
          await startMessageListener();
          log('Message listener ended, restarting in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          log(`Failed to restart message listener: ${error.message}`, 'ERROR');
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
      onMessage(handler) {
        log(`Adding message handler, total handlers: ${messageHandlers.size + 1}`);
        messageHandlers.add(handler);
        return () => {
          log(`Removing message handler, remaining: ${messageHandlers.size - 1}`);
          messageHandlers.delete(handler);
        };
      },

      // Send message on this channel
      async sendMessage(message) {
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
          if (addResponse.Error) {
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
          if (generateResponse.Error) {
            throw new Error(`Failed to generate completion: ${JSON.stringify(generateResponse.Error)}`);
          }
          log('Message send completed successfully');
        } finally {
          sendConnection.close();
        }
      },

      // Close the channel
      close() {
        connection.close();
      }
    };
  }

  /**
   * Send a message to an actor (one-shot operation)
   */
  async sendActorMessage(actorId, message) {
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

      if (response.Error) {
        throw new Error(`Actor message failed: ${JSON.stringify(response.Error)}`);
      }

    } finally {
      connection.close();
    }
  }

  /**
   * List all actors (one-shot operation)
   */
  async listActors() {
    const connection = await this.createConnection();

    try {
      await connection.send('ListActors', {});

      const response = await connection.receive();

      if (response.ActorList) {
        return response.ActorList.actors;
      } else if (response.Error) {
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
  async getActorStatus(actorId) {
    const connection = await this.createConnection();

    try {
      await connection.send('GetActorStatus', {
        id: actorId
      });

      const response = await connection.receive();

      if (response.ActorStatus) {
        return response.ActorStatus.status;
      } else if (response.Error) {
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
  async stopActor(actorId) {
    const connection = await this.createConnection();

    try {
      await connection.send('StopActor', {
        id: actorId
      });

      const response = await connection.receive();

      if (response.ActorStopped) {
        return true;
      } else if (response.Error) {
        throw new Error(`Failed to stop actor: ${JSON.stringify(response.Error)}`);
      }

      return false;
    } finally {
      connection.close();
    }
  }
}

/**
 * Git-focused chat UI component - simplified version
 */

import { render, Box, Text, useStdin } from 'ink';
import Spinner from 'ink-spinner';
import { useState, useEffect, useCallback } from 'react';
import {
  MessageComponent,
  HelpPanel,
  useMessageState,
  type ToolDisplayMode,
  type SetupStatus,
} from 'terminal-chat-ui';

import { MultiLineInput } from './MultiLineInput.js';
import type { ChatSession, CLIOptions, ChatConfig, } from '../types.js';
import { TheaterChatClient, type ActorLifecycleCallbacks, formatConnectionError } from '../theater-client.js';
import { formatActorError } from '../error-parser.js';
import { formatTheaterError, getServerAddress, shouldExitOnError } from '../enhanced-error-parser.js';
import { autoSaveChatSession } from '../config-resolver.js';
import type { ChannelStream } from 'theater-client';

interface ChatAppProps {
  options: {
    server?: string;
    verbose?: boolean;
  };
  config: ChatConfig;
  onCleanupReady?: (cleanup: () => Promise<void>) => void;
}

/**
 * Format byte array to hex string with optional shortening
 */
function formatHash(hash: number[], shorten: boolean = true): string {
  const bytes = new Uint8Array(hash);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  if (shorten && hex.length > 16) {
    return `${hex.slice(0, 8)}..${hex.slice(-8)}`;
  }
  return hex;
}

/**
 * Format timestamp for event display
 */
function formatEventTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Parse UTF-8 data from byte array
 */
function parseEventData(data: number[]): string | null {
  try {
    const bytes = new Uint8Array(data);
    const text = new TextDecoder('utf-8').decode(bytes);
    // Check if it's printable text (basic heuristic)
    if (text.length > 0 && /^[\x20-\x7E\s]*$/.test(text)) {
      return text;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Format actor events for user-friendly display (theater CLI style)
 */
function formatEventForDisplay(event: any): string {
  try {
    // Handle ChainEvent structure
    if (event.event_type && event.timestamp && event.hash) {
      const timestamp = formatEventTimestamp(event.timestamp);
      const eventType = event.event_type;

      // Create the main event line
      let result = `EVENT [${timestamp}] ${eventType}`;

      // Add description if available
      if (event.description) {
        result += `\n   ${event.description}`;
      } else if (event.data && event.data.length > 0) {
        // Try to parse data as text
        const text = parseEventData(event.data);
        if (text) {
          // Truncate long text
          const maxLength = 100;
          const displayText = text.length > maxLength ?
            `${text.slice(0, maxLength)}...` : text;
          result += `\n   ${displayText}`;
        } else {
          result += `\n   ${event.data.length} bytes of binary data`;
        }
      }

      return result;
    }

    // Handle other event types with fallback
    const timestamp = new Date().toLocaleTimeString();
    if (event.type) {
      return `EVENT [${timestamp}] ${event.type}\n   ${JSON.stringify(event, null, 0).slice(0, 100)}...`;
    }

    // Final fallback
    const eventStr = JSON.stringify(event, null, 0);
    return `EVENT [${timestamp}] unknown\n   ${eventStr.slice(0, 80)}${eventStr.length > 80 ? '...' : ''}`;

  } catch (error) {
    const timestamp = new Date().toLocaleTimeString();
    return `EVENT [${timestamp}] parse-error\n   [Unable to parse event]`;
  }
}

/**
 * Setup event log component
 */
function SetupEventLog({ events }: { events: string[] }) {
  if (events.length === 0) {
    return null;
  }

  // Show last 8 events to avoid cluttering the screen
  const recentEvents = events.slice(-8);

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      <Text color="gray" dimColor>Recent events:</Text>
      {recentEvents.map((event, index) => {
        // Split multi-line events and render each line
        const lines = event.split('\n');
        return (
          <Box key={index} flexDirection="column">
            {lines.map((line, lineIndex) => {
              // First line is the main event line
              if (lineIndex === 0) {
                // Parse event type for color coding
                const eventTypeMatch = line.match(/EVENT \[.*?\] ([^\s]+)/);
                const eventType = eventTypeMatch ? eventTypeMatch[1] : '';

                // Color based on event type category
                let color = 'cyan';
                if (eventType && eventType.includes('runtime')) color = 'blue';
                else if (eventType && eventType.includes('store')) color = 'green';
                else if (eventType && eventType.includes('message')) color = 'magenta';
                else if (eventType && eventType.includes('error')) color = 'red';
                else if (eventType && eventType.includes('wasm')) color = 'yellow';

                return (
                  <Text key={lineIndex} color={color} dimColor>
                    {line}
                  </Text>
                );
              } else {
                // Subsequent lines are descriptions/details
                return (
                  <Text key={lineIndex} color="white" dimColor>
                    {line}
                  </Text>
                );
              }
            })}
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Simple loading indicator component
 */
function LoadingIndicator() {
  return (
    <Box paddingLeft={1} >
      <Text color="gray">Assistant: </Text>
      <Spinner type="dots" />
      <Text color="gray" dimColor> thinking...</Text>
    </Box>
  );
}

/**
 * MultiLineInput wrapper with proper vim-style mode management
 */
function MultiLineInputWithModes({
  placeholder,
  onSubmit,
  disabled,
  verbose,
}: {
  placeholder: string;
  onSubmit: (content: string) => void;
  disabled: boolean;
  verbose: boolean;
}) {
  const [content, setContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mode, setMode] = useState<'insert' | 'command'>('insert');

  const handleModeChange = useCallback((newMode: 'insert' | 'command') => {
    setMode(newMode);
  }, []);

  const handleSubmit = useCallback((submittedContent: string) => {
    if (verbose) {
      console.log(`Submitting content: "${submittedContent}"`);
    }
    onSubmit(submittedContent);
    // Reset state after submit
    setContent('');
    setCursorPosition(0);
    setMode('insert');
  }, [onSubmit]);

  return (
    <Box flexDirection="column" width="100%">
      <MultiLineInput
        placeholder={placeholder}
        onSubmit={handleSubmit}
        disabled={disabled}
        mode={mode}
        onModeChange={handleModeChange}
        content={content}
        cursorPosition={cursorPosition}
        onContentChange={setContent}
        onCursorChange={setCursorPosition}
        verbose={verbose}
      />

      {/* Mode help text */}
      <Box paddingLeft={1}>
        <Text color="gray" dimColor>
          {mode === 'insert' ? (
            "ESC: command mode"
          ) : (
            "ENTER: send • i: insert mode • ESC: back to insert"
          )}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Main Chat application with simplified message handling
 */
function ChatApp({ options, config, onCleanupReady }: ChatAppProps) {
  const { isRawModeSupported, setRawMode, stdin } = useStdin();

  // Check for raw mode support
  if (!isRawModeSupported) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">❌ Raw mode not supported in this terminal environment</Text>
        <Text color="gray">This application requires a TTY terminal with raw mode support.</Text>
        <Text color="gray">Try running directly in your terminal instead of through a build tool.</Text>
      </Box>
    );
  }

  const [client, setClient] = useState<TheaterChatClient | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [channel, setChannel] = useState<ChannelStream | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>('connecting');
  const [setupMessage, setSetupMessage] = useState<string>('Connecting to Theater...');
  const [toolDisplayMode, setToolDisplayMode] = useState<ToolDisplayMode>('minimal');
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [actorHasExited, setActorHasExited] = useState<boolean>(false);
  const [setupEvents, setSetupEvents] = useState<string[]>([]);

  // Enable raw mode for input capture
  useEffect(() => {
    if (isRawModeSupported) {
      setRawMode(true);
      return () => {
        setRawMode(false);
      };
    }
    // Return undefined cleanup function for when raw mode is not supported
    console.warn('Raw mode is not supported in this terminal environment.');
    return undefined;
  }, [isRawModeSupported, setRawMode]);


  // Use simplified message state management
  const {
    messages,
    addMessage,
    addToolMessage,
    clearMessages
  } = useMessageState();

  // Create cleanup function that can be called from outside
  const cleanup = useCallback(async () => {
    try {
      if (options.verbose) {
        console.log('\nCleaning up actors...');
      }

      // Close channel first
      if (channel) {
        try {
          channel.close();
        } catch (error) {
          // Ignore channel close errors
        }
      }

      // Stop actor
      if (session && client) {
        await client.stopActor(session.domainActor);
        if (options.verbose) {
          console.log('Cleanup completed.');
        }
      }
    } catch (error) {
      if (options.verbose) {
        console.error(`Warning: Cleanup error - ${error instanceof Error ? error.message : String(error)}`);
      }
      // Don't throw - we want to exit gracefully even if cleanup fails
    }
  }, [client, session, channel, options.verbose]);

  // Expose cleanup function to parent when ready
  useEffect(() => {
    if (client && session && onCleanupReady) {
      onCleanupReady(cleanup);
    }
  }, [client, session, cleanup, onCleanupReady]);

  // Setup channel communication
  useEffect(() => {
    async function setupChannel() {
      try {
        setSetupStatus('connecting');
        setSetupMessage('Connecting to Theater...');

        const client = new TheaterChatClient(options.server || '127.0.0.1:9000', options.verbose || false);
        setClient(client);

        setSetupStatus('starting_actor');
        setSetupMessage(`Spinning up Actor...`);

        // Create actor lifecycle callbacks
        const actorCallbacks: ActorLifecycleCallbacks = {
          onActorExit: (result: any) => {
            //console.log('Domain actor exited:', result);
            setActorHasExited(true);
            setIsGenerating(false);

            // For other cases or chat mode, show the shutdown message
            addMessage('system', 'assistant has shut down.');

            // Trigger app shutdown
            setTimeout(async () => {
              await cleanup();
              process.exit(0);
            }, 1000); // Give user time to see the message
          },

          onActorError: (error: any) => {
            if (options.verbose) {
              console.error('Domain actor error:', JSON.stringify(error, null, 2));
            }
            setActorHasExited(true);
            setIsGenerating(false);
            const serverAddress = getServerAddress(options);
            const errorMessage = formatTheaterError(error, serverAddress);
            addMessage('error', `assistant error: ${errorMessage}`);

            // Trigger app shutdown on error
            setTimeout(async () => {
              await cleanup();
              process.exit(1);
            }, 2000); // Give user time to see the error
          },

          onActorEvent: (event: any) => {
            // Optional: handle specific events if needed
            if (options.verbose) {
              console.log('Domain actor event:', event);
            }
          }
        };

        // Start domain actor with callbacks
        if (options.verbose) {
          console.log('Starting domain actor with: ', config)
        }
        const domainActor = await client.startDomainActor(
          config.actor.manifest_path,
          config.actor.initial_state,
          actorCallbacks
        );
        setSetupMessage(`Actor started: ${domainActor.id}`);
        setSetupStatus('loading_actor');
        const chatActorId = await client.getChatStateActorId(domainActor);

        const chatActor = await client.getActorById(chatActorId);
        // subscribe to the actor's events and print them to the console
        // chatActor.subscribe() returns a promise that resolves to an ActorEventStream
        // which we can use to listen for events
        chatActor.subscribe().then((stream) => {
          stream.onEvent((message) => {
            // Add event to setup log
            const formattedEvent = formatEventForDisplay(message);
            setSetupEvents(prev => [...prev, formattedEvent]);

            if (options.verbose) {
              console.log(`Chat actor event: ${JSON.stringify(message, null, 2)}`);
            }
          });

          stream.onError((error) => {
            const errorEvent = `[${new Date().toLocaleTimeString()}] ERROR: ${error instanceof Error ? error.message : String(error)}`;
            setSetupEvents(prev => [...prev, errorEvent]);
            console.error(`Chat actor error: ${error instanceof Error ? error.message : String(error)}`);
          });
        }).catch((error) => {
          const errorEvent = `[${new Date().toLocaleTimeString()}] SUBSCRIPTION ERROR: ${error instanceof Error ? error.message : String(error)}`;
          setSetupEvents(prev => [...prev, errorEvent]);
          console.error(`Failed to subscribe to chat actor events: ${error instanceof Error ? error.message : String(error)}`);
        });


        setSetupMessage(`Chat actor ID: ${chatActorId}`);
        const session: ChatSession = {
          domainActor,
          chatActorId
        };
        setSession(session);

        setSetupStatus('opening_channel');
        setSetupMessage('Opening communication channel...');

        const channelStream = await client.openChannelStream(session.chatActorId);

        // Add error handling for channel stream
        channelStream.onError((error) => {
          console.error('Channel stream error:', error);
          const errorMessage = formatConnectionError(error);
          addMessage('error', `Channel error: ${errorMessage}`);
          setIsGenerating(false);
        });

        channelStream.onClose(() => {
          console.log('Channel stream closed');
          if (!actorHasExited) {
            addMessage('system', 'Connection to chat actor closed');
            setActorHasExited(true);
          }
        });

        // Channel stream opened successfully
        setSetupMessage('Channel connected');

        // Auto-save chat session metadata
        try {
          setSetupMessage('Saving chat session...');
          // Get the chat actor instance and request metadata
          //const chatActor = await client.getActorById(chatActorId);
          const metadataResponse = await domainActor.requestJson({
            type: 'get_metadata'
          });

          if (metadataResponse) {
            // Remove the type wrapper and extract metadata
            const { type, ...metadata } = metadataResponse;

            // Merge original actor config with session metadata
            const savedConfig = {
              actor: {
                manifest_path: config.actor.manifest_path,
                initial_state: metadata
              }
            };

            const filename = autoSaveChatSession(savedConfig);
            setSetupMessage(`Chat saved as: saved/${filename}`);
          }
        } catch (error) {
          if (options.verbose) {
            console.error('Failed to save chat session:', error);
          }
          // Don't fail the whole setup if save fails
        }

        setSetupStatus('loading_actor');
        setSetupMessage('Loading chat actor...');

        channelStream.onMessage((message) => {
          try {
            const messageText = Buffer.from(message.data).toString('utf8');
            const parsedMessage = JSON.parse(messageText);
            if (parsedMessage.type === 'chat_message' && parsedMessage.message) {
              const messageEntry = parsedMessage?.message?.entry;
              const isUserMessage = messageEntry?.Message?.role === 'User'; // Note: capital 'U'

              // Only process assistant messages
              if (!isUserMessage) {
                const messageContent = messageEntry?.Message?.content || messageEntry?.Completion?.content;
                const stopReason = messageEntry?.Message?.stop_reason || messageEntry?.Completion?.stop_reason;

                if (Array.isArray(messageContent)) {
                  let textContent = '';
                  // Process all content blocks
                  for (const block of messageContent) {
                    // Handle the new Rust enum format
                    if (block?.Text) {
                      // New format: {"Text": "Hello world"}
                      textContent += block.Text;
                    } else if (block?.ToolUse) {
                      // New format: {"ToolUse": {id: "...", name: "...", input: {...}}}
                      // Note: the field is "input" not "arguments" based on the bindings
                      const toolUse = block.ToolUse;

                      
                      // Decode any byte arrays in the input before displaying
                      let decodedInputValues: any[] = [];
                      if (toolUse?.input) {
                        // Check if input itself is a byte array
                        if (Array.isArray(toolUse.input) && toolUse.input.length > 0 && 
                            typeof toolUse.input[0] === 'number' && 
                            toolUse.input.every((v: any) => typeof v === 'number' && v >= 0 && v <= 255)) {
                          const decoded = parseEventData(toolUse.input);
                          decodedInputValues = [decoded || `[${toolUse.input.length} bytes]`];
                        } else {
                          // Handle as object with properties that might contain byte arrays
                          decodedInputValues = Object.values(toolUse.input).map((value: any) => {
                            // Check if this looks like a byte array (array of numbers)
                            if (Array.isArray(value) && value.length > 0 && 
                                typeof value[0] === 'number' && value.every(v => typeof v === 'number' && v >= 0 && v <= 255)) {
                              const decoded = parseEventData(value);
                              return decoded || `[${value.length} bytes]`;
                            }
                            return value;
                          });
                        }
                      }
                      
                      addToolMessage(toolUse?.name || 'unknown', decodedInputValues);
                    } else if (block?.ToolResult) {
                      // New format: {"ToolResult": {tool_use_id: "...", content: {...}, is_error: false}}
                      const toolResult = block.ToolResult;

                      // Display tool results in the UI
                      if (toolResult?.content && !toolResult?.is_error) {
                        // Handle successful tool result - content is JsonData (Vec<u8>)
                        // Decode the byte array to readable text
                        const decodedContent = parseEventData(toolResult.content);
                        if (decodedContent) {
                          try {
                            // Try to parse as JSON for pretty formatting
                            const jsonData = JSON.parse(decodedContent);
                            const prettyJson = JSON.stringify(jsonData, null, 2);
                            addMessage('system', `🔧 Tool Result:\n${prettyJson}`);
                          } catch {
                            // If not valid JSON, display as plain text
                            addMessage('system', `🔧 Tool Result: ${decodedContent}`);
                          }
                        } else {
                          // Fallback: display raw bytes if decoding fails
                          addMessage('system', `🔧 Tool Result: [${toolResult.content.length} bytes of binary data]`);
                        }
                      } else if (toolResult?.is_error) {
                        // Handle tool errors
                        const errorContent = toolResult.content ? parseEventData(toolResult.content) : 'Unknown error';
                        addMessage('error', `❌ Tool Error: ${errorContent || 'Tool execution failed'}`);
                      }
                    }

                    // Legacy support - remove this block once fully migrated
                    else if (block?.type === 'text' && block?.text) {
                      // Old format: {"type": "text", "text": "Hello world"}
                      textContent += block.text;
                    } else if (block?.type === 'tool_use') {
                      // Old format: {"type": "tool_use", "name": "...", "input": {...}}
                      addToolMessage(block?.name || 'unknown',
                        block?.input ? Object.values(block.input) : []);
                    }
                  }

                  // Add text content as a regular message if we have any
                  if (textContent.trim()) {
                    addMessage('assistant', textContent);
                  }
                } else if (typeof messageContent === 'string' && messageContent.trim()) {
                  // Add string content as a regular message
                  addMessage('assistant', messageContent);
                }

                // Check if we're done generating - handle new enum format
                if (stopReason === 'EndTurn' || stopReason === 'end_turn') {
                  setIsGenerating(false);
                }
              } else {
                // Add user message directly
                // Handle new format: content is array of {"Text": "..."} objects
                const content = messageEntry?.Message?.content;
                if (Array.isArray(content) && content.length > 0) {
                  // Extract text from first content block
                  const firstBlock = content[0];
                  const userText = firstBlock?.Text || firstBlock?.text || ''; // Support both formats
                  addMessage('user', userText);
                } else {
                  // Fallback for other formats
                  addMessage('user', content || '');
                }
              }
            }
          } catch (error) {
            const serverAddress = getServerAddress(options);
            const errorMessage = formatTheaterError(error, serverAddress);
            addMessage('error', `Error: ${errorMessage}`);
            setIsGenerating(false);
          }
        });

        setChannel(channelStream);

        await client.startWorkflow(session.domainActor);

        setSetupStatus('ready');
        // Clear setup events now that we're ready
        setSetupEvents([]);

      } catch (error) {
        setSetupStatus('error');
        // Use enhanced connection error formatting first
        let errorMessage = formatConnectionError(error);
        // Fall back to theater error formatting if not a connection error
        if (errorMessage === (error instanceof Error ? error.message : String(error))) {
          const serverAddress = getServerAddress(options);
          errorMessage = formatTheaterError(error, serverAddress);
        }
        setSetupMessage(`Error: ${errorMessage}`);
        setIsGenerating(false);

        // Exit immediately if this is a connection error
        if (shouldExitOnError(error)) {
          await cleanup();
          process.exit(1);
        }
      }
    }

    setupChannel();
  }, [addMessage, addToolMessage]);

  // Send message function
  const sendMessage = useCallback(async (messageText: string) => {
    if (!client || !session || !channel || !messageText.trim() || isGenerating || actorHasExited) return;

    try {
      setIsGenerating(true);

      // Send message through domain actor (user message will be added via channel stream)
      await client.sendMessage(session.domainActor, messageText.trim());

    } catch (error) {
      const serverAddress = getServerAddress(options);
      const errorMessage = formatTheaterError(error, serverAddress);
      addMessage('error', `Error sending message: ${errorMessage}`);
      setIsGenerating(false);
    }
  }, [channel, client, session, addMessage, isGenerating, actorHasExited]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channel) {
        try {
          channel.close();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, [channel]);

  return (
    <Box flexDirection="column" height="100%" width="100%">
      {session && (
        <Box flexDirection="column" alignItems="flex-start" >
          <Text color="gray"> management actor-id: {session.domainActor.id} </Text>
          <Text color="gray">       chat actor-id: {session.chatActorId} </Text>
        </Box>
      )}

      {showHelp && (
        <HelpPanel
          shortcuts={[
            { key: 'Ctrl+C', description: 'Exit' },
            { key: 'Ctrl+L', description: 'Clear messages' },
            { key: 'Ctrl+T', description: 'Toggle tool display' },
            { key: 'Ctrl+H', description: 'Toggle help' }
          ]}
        />
      )}

      {setupStatus !== 'ready' ? (
        <Box flexDirection="column" flexGrow={1} width="100%" justifyContent="center" alignItems="flex-start">
          <Box paddingLeft={1}>
            <Spinner type="dots" />
            <Text color="cyan"> {setupMessage}</Text>
          </Box>
          <SetupEventLog events={setupEvents} />
        </Box>
      ) : (
        <>
          <Box flexDirection="column" width="100%" paddingLeft={1} paddingRight={1} marginTop={1}>
            <>
              {/* Render all messages */}
              {messages.map((message, index) => (
                <MessageComponent
                  key={index}
                  message={message}
                  toolDisplayMode={toolDisplayMode}
                  prefixOverrides={{
                    user: '',
                    assistant: '',
                    system: '[system] ',
                    tool: '[tool] '
                  }}
                />
              ))}

              {/* Show loading indicator when generating (but not if actor has exited) */}
              {isGenerating && !actorHasExited && <LoadingIndicator />}
            </>
          </Box>

          {/* Conditional input rendering based on mode */}
          <Box width="100%" paddingLeft={1} paddingRight={1} paddingBottom={1}>
            <Box width="100%">
              <MultiLineInputWithModes
                placeholder={
                  actorHasExited ? "Assistant has shut down" :
                    isGenerating ? "Processing..." : "Message: "
                }
                onSubmit={sendMessage}
                disabled={isGenerating || actorHasExited}
                verbose={options.verbose || false}
              />
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

/**
 * Render the Chat app with proper cleanup handling
 */
export async function renderChatApp(
  options: CLIOptions,
  config: ChatConfig
): Promise<void> {
  let app: any = null;
  let appCleanup: (() => Promise<void>) | null = null;
  let signalHandlersRegistered = false;

  const cleanup = async () => {
    try {
      // Call app-specific cleanup first (stops actors)
      if (appCleanup) {
        await appCleanup();
      }
    } catch (error) {
      if (options.verbose) {
        console.error(`Cleanup error: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      // Always unmount the app
      if (app) {
        app.unmount();
      }
    }
  };

  const setupSignalHandlers = () => {
    if (signalHandlersRegistered) return;
    signalHandlersRegistered = true;

    const handleSignal = async (signal: string) => {
      if (options.verbose) {
        console.log(`\nReceived ${signal}, cleaning up...`);
      }
      await cleanup();
      process.exit(signal === 'SIGINT' ? 130 : 143); // Standard exit codes
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));

    // Also handle process exit
    process.on('exit', async () => {
      // Note: In 'exit' handler, you can't do async operations
      // So we only do synchronous cleanup here
      if (app) {
        app.unmount();
      }
    });
  };

  try {
    // Set up signal handlers early
    setupSignalHandlers();

    app = render(
      <ChatApp
        options={options}
        config={config}
        onCleanupReady={(cleanupFn) => {
          appCleanup = cleanupFn;
          if (options.verbose) {
            console.log('Cleanup handlers registered');
          }
        }}
      />
    );

    // Wait for the app to finish (in case of workflow mode auto-exit)
    await new Promise<void>((resolve) => {
      app.waitUntilExit().then(() => {
        resolve();
      });
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    await cleanup();
    process.exit(1);
  } finally {
    await cleanup();
  }
}

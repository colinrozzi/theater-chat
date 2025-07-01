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
import { TheaterChatClient, type ActorLifecycleCallbacks } from '../theater-client.js';
import { formatActorError } from '../error-parser.js';
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
            const errorMessage = formatActorError(error);
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
        const domainActor = await client.startDomainActor(
          config.actor.manifest_path,
          config.actor.initial_state,
          actorCallbacks
        );
        setSetupMessage(`Actor started: ${domainActor.id}`);
        setSetupStatus('loading_actor');
        const chatActorId = await client.getChatStateActorId(domainActor);
        setSetupMessage(`Chat actor ID: ${chatActorId}`);
        const session: ChatSession = {
          domainActor,
          chatActorId
        };
        setSession(session);

        setSetupStatus('opening_channel');
        setSetupMessage('Opening communication channel...');

        const channelStream = await client.openChannelStream(session.chatActorId);

        setSetupStatus('loading_actor');
        setSetupMessage('Loading chat actor...');

        // Set up simplified message handler
        channelStream.onMessage((message) => {
          try {
            const messageText = Buffer.from(message.data).toString('utf8');
            const parsedMessage = JSON.parse(messageText);

            if (parsedMessage.type === 'chat_message' && parsedMessage.message) {
              const messageEntry = parsedMessage?.message?.entry;
              const isUserMessage = messageEntry?.Message?.role === 'user';

              // Only process assistant messages
              if (!isUserMessage) {
                const messageContent = messageEntry?.Message?.content || messageEntry?.Completion?.content;
                const stopReason = messageEntry?.Message?.stop_reason || messageEntry?.Completion?.stop_reason;

                if (Array.isArray(messageContent)) {
                  let textContent = '';

                  // Process all content blocks
                  for (const block of messageContent) {
                    if (block?.type === 'text' && block?.text) {
                      textContent += block.text;

                      // Add text content as a regular message if we have any
                      if (textContent.trim()) {
                        addMessage('assistant', textContent);
                      }
                    } else if (block?.type === 'tool_use') {
                      // Add tool message immediately
                      addToolMessage(block?.name || 'unknown',
                        block?.input ? Object.values(block.input) : []);
                    }
                  }
                } else if (typeof messageContent === 'string' && messageContent.trim()) {
                  // Add string content as a regular message
                  addMessage('assistant', messageContent);
                }

                // Check if we're done generating
                if (stopReason === 'end_turn') {
                  setIsGenerating(false);
                }
              } else {
                // Add user message directly
                //console.log('User message received:', messageEntry?.Message?.content);
                //console.log('User message text:', messageEntry?.Message?.content[0]?.text);
                addMessage('user', messageEntry?.Message?.content[0]?.text || '');
              }
            }
          } catch (error) {
            addMessage('error', `Error: ${formatActorError(error)}`);
            setIsGenerating(false);
          }
        });

        setChannel(channelStream);

        await client.startWorkflow(session.domainActor);

        setSetupStatus('ready');

      } catch (error) {
        setSetupStatus('error');
        const errorMessage = formatActorError(error);
        setSetupMessage(`Error: ${errorMessage}`);
        setIsGenerating(false);
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
      const errorMessage = formatActorError(error);
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

import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Main application component
 */
function ChatApp({ theaterClient, actorId, config, initialMessage }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [channel, setChannel] = useState(null);
  const [setupStatus, setSetupStatus] = useState('connecting'); // 'connecting', 'opening_channel', 'loading_actor', 'ready', 'error'
  const [setupMessage, setSetupMessage] = useState('Connecting to Theater...');
  const [toolDisplayMode, setToolDisplayMode] = useState('minimal'); // 'hidden', 'minimal', 'full'
  const [showInstructions, setShowInstructions] = useState(true);
  const { exit } = useApp();

  // Setup status messages
  const setupSteps = {
    connecting: 'Connecting to Theater...',
    opening_channel: 'Opening communication channel...',
    loading_actor: 'Loading chat actor...',
    ready: initialMessage
      ? `Starting with initial message...`
      : 'Type your questions or commands.',
    error: 'Failed to connect to Theater server'
  };

  const addMessage = useCallback((role, content, status = 'complete') => {
    setMessages(prev => [...prev, { role, content, status }]);
  }, []);

  const updateMessageStatus = useCallback((messageIndex, status) => {
    setMessages(prev => prev.map((msg, i) =>
      i === messageIndex ? { ...msg, status } : msg
    ));
  }, []);

  const addPendingMessage = useCallback((role, content) => {
    const messageIndex = messages.length;
    addMessage(role, content, 'pending');
    return messageIndex;
  }, [messages.length, addMessage]);

  // Set up channel communication
  useEffect(() => {
    let setupTimeout;

    async function setupChannel() {
      try {
        setSetupStatus('connecting');
        setSetupMessage(setupSteps.connecting);

        // Add a small delay to show the connecting state
        await new Promise(resolve => setTimeout(resolve, 500));

        setSetupStatus('opening_channel');
        setSetupMessage(setupSteps.opening_channel);

        const channelStream = await theaterClient.openChannelStream(actorId);

        setSetupStatus('loading_actor');
        setSetupMessage(setupSteps.loading_actor);

        // Wait a bit for actor to fully initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        setChannel(channelStream);
        setSetupStatus('ready');

        // Add the welcome message
        addMessage('system', setupSteps.ready);

        // Set up message handler
        channelStream.onMessage((message) => {
          try {
            // Convert message bytes to string
            const messageText = Buffer.from(message.message).toString('utf8');
            const parsedMessage = JSON.parse(messageText);

            if (parsedMessage.type === 'chat_message' && parsedMessage.message) {
              // Check if this is a user message echo (confirmation)
              const isUserMessage = parsedMessage.message?.entry?.Message?.role === 'user';

              if (isUserMessage) {
                // This is the echo of our user message - confirm the last pending user message
                setMessages(prev => {
                  const lastUserIndex = prev.map((msg, i) => ({ ...msg, index: i }))
                    .reverse()
                    .find(msg => msg.role === 'user' && msg.status === 'pending')?.index;

                  if (lastUserIndex !== undefined) {
                    return prev.map((msg, i) =>
                      i === lastUserIndex ? { ...msg, status: 'complete' } : msg
                    );
                  }
                  return prev;
                });
              } else {
                // This is an assistant message
                const completion = parsedMessage.message?.entry?.Completion;
                const message = parsedMessage.message?.entry?.Message;
                
                let content = 'Empty response';
                if (completion?.content) {
                  // Extract text from completion content array
                  const textContent = completion.content
                    .filter(item => item.type === 'text')
                    .map(item => item.text)
                    .join('');
                  content = textContent || 'Empty response';
                } else if (message?.content) {
                  // Fallback to Message content
                  content = message.content;
                }

                // Check if we have a pending assistant message to update
                setMessages(prev => {
                  const lastAssistantIndex = prev.map((msg, i) => ({ ...msg, index: i }))
                    .reverse()
                    .find(msg => msg.role === 'assistant' && msg.status === 'pending')?.index;

                  if (lastAssistantIndex !== undefined) {
                    // Update the existing pending message
                    return prev.map((msg, i) =>
                      i === lastAssistantIndex
                        ? { ...msg, content, status: 'complete' }
                        : msg
                    );
                  } else {
                    // Add a new assistant message
                    return [...prev, { role: 'assistant', content, status: 'complete' }];
                  }
                });

                setIsLoading(false);
              }
            } else if (parsedMessage.type === 'tool_call_delta') {
              // Handle tool calls - just add the tool call message
              const { tool_name, args } = parsedMessage;

              // Get a nice display name for the tool
              const toolDisplayName = getToolDisplayName(tool_name, args);

              addMessage('tool', `🔧 ${toolDisplayName}`, 'complete');
            }
          } catch (parseError) {
            console.error('Failed to parse message:', parseError);
            addMessage('system', `Error parsing message: ${parseError.message}`, 'complete');
          }
        });

        // Send initial message if provided
        if (initialMessage) {
          setTimeout(() => {
            sendMessage(initialMessage);
          }, 1000);
        }

      } catch (error) {
        setSetupStatus('error');
        setSetupMessage(`Error: ${error.message}`);
        console.error('Setup error:', error);
      }
    }

    setupChannel();

    return () => {
      if (setupTimeout) clearTimeout(setupTimeout);
    };
  }, [theaterClient, actorId, initialMessage]);

  // Function to send messages
  const sendMessage = useCallback(async (messageText) => {
    if (!channel || !messageText.trim()) return;

    try {
      setIsLoading(true);

      // Add user message as pending
      addPendingMessage('user', messageText.trim());

      // Add pending assistant message
      addPendingMessage('assistant', '');

      // Send message to the channel
      await channel.sendMessage(messageText.trim());

      setInputValue('');

    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('system', `Error sending message: ${error.message}`, 'complete');
      setIsLoading(false);
    }
  }, [channel, addPendingMessage, addMessage]);

  // Handle input submission
  const handleSubmit = useCallback(() => {
    sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  // Keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }

    if (key.ctrl && input === 'l') {
      setMessages([]);
    }

    // Toggle tool display mode with Ctrl+T
    if (key.ctrl && input === 't') {
      setToolDisplayMode(prev => {
        const modes = ['hidden', 'minimal', 'full'];
        const currentIndex = modes.indexOf(prev);
        return modes[(currentIndex + 1) % modes.length];
      });
    }

    // Toggle instructions with Ctrl+H
    if (key.ctrl && input === 'h') {
      setShowInstructions(prev => !prev);
    }
  });

  // Auto-cleanup on unmount
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
    <Box flexDirection="column" height={process.stdout.rows - 1}>
      {/* Header */}
      <ChatHeader config={config} setupStatus={setupStatus} setupMessage={setupMessage} />

      {/* Instructions */}
      {showInstructions && setupStatus === 'ready' && (
        <Box marginBottom={1}>
          <Text color="gray">
            💡 Shortcuts: Ctrl+C (exit), Ctrl+L (clear), Ctrl+T (tool display), Ctrl+H (toggle help)
          </Text>
        </Box>
      )}

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} paddingBottom={1}>
        {messages.map((message, index) => (
          <MessageComponent
            key={index}
            message={message}
            toolDisplayMode={toolDisplayMode}
          />
        ))}
      </Box>

      {/* Input */}
      {setupStatus === 'ready' && (
        <Box>
          <Text color="gray">💬 </Text>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            placeholder="Type your question or command..."
            showCursor={!isLoading}
          />
          {isLoading && (
            <Box marginLeft={1}>
              <Spinner type="dots" />
              <Text color="yellow"> Thinking...</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * Chat header component
 */
function ChatHeader({ config, setupStatus, setupMessage }) {
  const title = config.title || 'Chat Session';

  return (
    <Box flexDirection="column" paddingBottom={1} borderStyle="round" borderColor="cyan">
      <Box justifyContent="space-between">
        <Text color="cyan">🎭 {title}</Text>
        <Text color="gray">{config.model_config?.model || 'Unknown Model'}</Text>
      </Box>

      <Box>
        <Text color="gray">Status: </Text>
        {setupStatus === 'ready' ? (
          <Text color="green">Ready</Text>
        ) : setupStatus === 'error' ? (
          <Text color="red">Error</Text>
        ) : (
          <Box>
            <Spinner type="dots" />
            <Text color="yellow"> {setupMessage}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * Message component
 */
function MessageComponent({ message, toolDisplayMode }) {
  const { role, content, status } = message;

  if (role === 'tool' && toolDisplayMode === 'hidden') {
    return null;
  }

  const roleColor = {
    user: 'blue',
    assistant: 'green',
    system: 'gray',
    tool: 'magenta'
  }[role] || 'white';

  const roleIcon = {
    user: '👤',
    assistant: '🤖',
    system: 'ℹ️',
    tool: '🔧'
  }[role] || '•';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={roleColor}>{roleIcon} {role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : role}: </Text>
        {status === 'pending' && role !== 'tool' && (
          <Box marginLeft={1}>
            <Spinner type="dots" />
          </Box>
        )}
      </Box>

      {content && (
        <Box marginLeft={2}>
          <FormattedContent content={content} role={role} toolDisplayMode={toolDisplayMode} />
        </Box>
      )}
    </Box>
  );
}

/**
 * Formatted content component
 */
function FormattedContent({ content, role, toolDisplayMode }) {
  // For tool messages, keep them concise unless in full mode
  if (role === 'tool' && toolDisplayMode === 'minimal') {
    return <Text color="gray">{content}</Text>;
  }

  // Split content into lines and render with basic formatting
  const lines = content.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <Text key={index}>{line || ' '}</Text>
      ))}
    </Box>
  );
}

/**
 * Get display name for tools
 */
function getToolDisplayName(toolName, args) {
  // Provide nice display names for common tools
  const toolNames = {
    'read': 'Reading file',
    'write': 'Writing file',
    'list': 'Listing directory',
    'search': 'Searching files',
    'edit': 'Editing file',
    'delete': 'Deleting file',
    'mkdir': 'Creating directory',
    'move': 'Moving file',
    'copy': 'Copying file'
  };

  return toolNames[toolName] || `${toolName}`;
}

/**
 * Render the app and handle cleanup
 */
export async function renderApp(theaterClient, actorId, config, initialMessage) {
  let app = null;

  const cleanup = async () => {
    try {
      if (actorId && theaterClient) {
        await theaterClient.stopActor(actorId);
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    if (app) {
      app.unmount();
    }
  };

  // Set up cleanup on exit
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    app = render(
      <ChatApp
        theaterClient={theaterClient}
        actorId={actorId}
        config={config}
        initialMessage={initialMessage}
      />
    );

    await app.waitUntilExit();
  } finally {
    await cleanup();
  }
}

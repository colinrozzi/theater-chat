import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp, Instance } from 'ink';
import MultiLineInput from './MultiLineInput.js';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import type { ChatConfig } from './types.js';
import type { TheaterClient } from './theater.js';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  status: 'pending' | 'complete';
  toolName?: string;
  toolArgs?: string[];
}

type SetupStatus = 'connecting' | 'opening_channel' | 'loading_actor' | 'ready' | 'error';
type InputMode = 'insert' | 'normal';
type ToolDisplayMode = 'hidden' | 'minimal' | 'full';

interface ChatAppProps {
  theaterClient: TheaterClient;
  actorId: string;
  config: ChatConfig;
  initialMessage?: string;
}

interface ChatHeaderProps {
  config: ChatConfig;
  setupStatus: SetupStatus;
  setupMessage: string;
}

interface MessageComponentProps {
  message: Message;
  toolDisplayMode: ToolDisplayMode;
}

interface FormattedContentProps {
  content: string;
  role: string;
  toolDisplayMode: ToolDisplayMode;
  contentColor: string;
  message: Message;
}

/**
 * Main application component
 */
function ChatApp({ theaterClient, actorId, config, initialMessage }: ChatAppProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>('insert');
  const [inputContent, setInputContent] = useState<string>('');
  const [inputCursor, setInputCursor] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [channel, setChannel] = useState<any>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>('connecting');
  const [setupMessage, setSetupMessage] = useState<string>('Connecting to Theater...');
  const [toolDisplayMode, setToolDisplayMode] = useState<ToolDisplayMode>('minimal');
  const [showInstructions, setShowInstructions] = useState<boolean>(true);
  const { exit } = useApp();

  // Setup status messages
  const setupSteps: Record<SetupStatus, string> = {
    connecting: 'Connecting to Theater...',
    opening_channel: 'Opening communication channel...',
    loading_actor: 'Loading chat actor...',
    ready: initialMessage
      ? `Starting with initial message...`
      : 'Type your questions or commands.',
    error: 'Failed to connect to Theater server'
  };

  const addMessage = useCallback((role: Message['role'], content: string, status: Message['status'] = 'complete'): void => {
    setMessages(prev => [...prev, { role, content, status }]);
  }, []);

  const updateMessageStatus = useCallback((messageIndex: number, status: Message['status']): void => {
    setMessages(prev => prev.map((msg, i) =>
      i === messageIndex ? { ...msg, status } : msg
    ));
  }, []);

  const addPendingMessage = useCallback((role: Message['role'], content: string): number => {
    const messageIndex = messages.length;
    addMessage(role, content, 'pending');
    return messageIndex;
  }, [messages.length, addMessage]);

  const addToolMessage = useCallback((toolName: string, toolArgs: string[]): void => {
    setMessages(prev => {
      const lastAssistantIndex = prev.map((msg, i) => ({ ...msg, index: i }))
        .reverse()
        .find(msg => msg.role === 'assistant' && msg.status === 'pending')?.index;

      const toolMessage: Message = {
        role: 'tool',
        content: toolName,
        toolName,
        toolArgs,
        status: 'complete'
      };

      if (lastAssistantIndex !== undefined) {
        const newMessages = [...prev];
        newMessages.splice(lastAssistantIndex, 0, toolMessage);
        return newMessages;
      } else {
        return [...prev, toolMessage];
      }
    });
  }, []);

  // Set up channel communication
  useEffect(() => {
    let setupTimeout: NodeJS.Timeout;

    async function setupChannel(): Promise<void> {
      try {
        setSetupStatus('connecting');
        setSetupMessage(setupSteps.connecting);

        await new Promise(resolve => setTimeout(resolve, 500));

        setSetupStatus('opening_channel');
        setSetupMessage(setupSteps.opening_channel);

        const channelStream = await theaterClient.openChannelStream(actorId);

        setSetupStatus('loading_actor');
        setSetupMessage(setupSteps.loading_actor);

        await new Promise(resolve => setTimeout(resolve, 1000));

        setChannel(channelStream);
        setSetupStatus('ready');

        channelStream.onMessage((message: any) => {
          try {
            const messageText = Buffer.from(message.message).toString('utf8');
            const parsedMessage = JSON.parse(messageText);

            if (parsedMessage.type === 'chat_message' && parsedMessage.message) {
              const isUserMessage = parsedMessage.message?.entry?.Message?.role === 'user';

              if (isUserMessage) {
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
                const completion = parsedMessage.message?.entry?.Completion;
                const message = parsedMessage.message?.entry?.Message;
                const stopReason = completion?.stop_reason || message?.stop_reason || parsedMessage.message?.stop_reason || parsedMessage.stop_reason;

                if (completion?.content) {
                  const toolCalls = completion.content.filter((item: any) => item.type === 'tool_use');
                  for (const toolCall of toolCalls) {
                    const toolArgs = toolCall.input ? Object.entries(toolCall.input).map(([key, value]) => {
                      if (typeof value === 'string') return value;
                      return JSON.stringify(value);
                    }) : [];
                    addToolMessage(toolCall.name, toolArgs);
                  }

                  const textContent = completion.content
                    .filter((item: any) => item.type === 'text')
                    .map((item: any) => item.text)
                    .join('');

                  if (textContent) {
                    setMessages(prev => {
                      const lastAssistantIndex = prev.map((msg, i) => ({ ...msg, index: i }))
                        .reverse()
                        .find(msg => msg.role === 'assistant' && msg.status === 'pending')?.index;

                      if (lastAssistantIndex !== undefined) {
                        return prev.map((msg, i) =>
                          i === lastAssistantIndex
                            ? { ...msg, content: textContent, status: 'complete' }
                            : msg
                        );
                      } else {
                        return [...prev, { role: 'assistant', content: textContent, status: 'complete' }];
                      }
                    });
                  }
                } else if (message?.content) {
                  let content = message.content;
                  if (Array.isArray(content)) {
                    content = content.map((item: any) => {
                      if (item.type === 'text') return item.text;
                      if (item.type === 'tool_result') return `Tool result: ${JSON.stringify(item.content)}`;
                      return JSON.stringify(item);
                    }).join('');
                  }

                  setMessages(prev => {
                    const lastAssistantIndex = prev.map((msg, i) => ({ ...msg, index: i }))
                      .reverse()
                      .find(msg => msg.role === 'assistant' && msg.status === 'pending')?.index;

                    if (lastAssistantIndex !== undefined) {
                      return prev.map((msg, i) =>
                        i === lastAssistantIndex
                          ? { ...msg, content, status: 'complete' }
                          : msg
                      );
                    } else {
                      return [...prev, { role: 'assistant', content, status: 'complete' }];
                    }
                  });
                }

                if (stopReason === 'end_turn') {
                  setIsGenerating(false);
                } else if (stopReason === 'stop_sequence' || stopReason === 'max_tokens') {
                  setIsGenerating(false);
                } else if (stopReason === 'tool_use') {
                  // Keep generating - waiting for tool results
                } else if (stopReason) {
                  setIsGenerating(false);
                }
              }
            }
          } catch (parseError) {
            console.error('Failed to parse message:', parseError);
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            addMessage('system', `Error parsing message: ${errorMessage}`, 'complete');
            setIsGenerating(false);
          }
        });

        if (initialMessage) {
          setTimeout(() => {
            sendMessage(initialMessage);
          }, 1000);
        }

      } catch (error) {
        setSetupStatus('error');
        const errorMessage = error instanceof Error ? error.message : String(error);
        setSetupMessage(`Error: ${errorMessage}`);
        console.error('Setup error:', error);
      }
    }

    setupChannel();

    return () => {
      if (setupTimeout) clearTimeout(setupTimeout);
    };
  }, [theaterClient, actorId, initialMessage]);

  // Function to send messages
  const sendMessage = useCallback(async (messageText: string): Promise<void> => {
    if (!channel || !messageText.trim()) return;

    try {
      setIsGenerating(true);

      addPendingMessage('user', messageText.trim());
      addPendingMessage('assistant', '');

      await channel.sendMessage(messageText.trim());

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addMessage('system', `Error sending message: ${errorMessage}`, 'complete');
      setIsGenerating(false);
    }
  }, [channel, addPendingMessage, addMessage]);

  // Handle input submission
  const handleSubmit = useCallback((content: string): void => {
    const messageContent = content || inputContent;
    if (messageContent.trim()) {
      sendMessage(messageContent.trim());
      setInputContent('');
      setInputCursor(0);
    }
  }, [sendMessage, inputContent]);

  // Keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }

    if (key.ctrl && input === 'l') {
      setMessages([]);
    }

    if (key.ctrl && input === 't') {
      setToolDisplayMode(prev => {
        const modes: ToolDisplayMode[] = ['hidden', 'minimal', 'full'];
        const currentIndex = modes.indexOf(prev);
        return modes[(currentIndex + 1) % modes.length];
      });
    }

    if (key.ctrl && input === 'h') {
      setShowInstructions(prev => !prev);
    }

    if (inputMode === 'normal') {
      if (key.return) {
        handleSubmit('');
        return;
      }

      if (input === 'i' && !key.ctrl && !key.meta) {
        setInputMode('insert');
        return;
      }
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
    <Box flexDirection="column" marginLeft={2}>
      <ChatHeader config={config} setupStatus={setupStatus} setupMessage={setupMessage} />

      {showInstructions && setupStatus === 'ready' && messages.length === 0 && (
        <Box marginBottom={1}>
          <Text color="gray">
            Shortcuts: Ctrl+C (exit), Ctrl+L (clear), Ctrl+T (tool display), Ctrl+H (toggle help)
          </Text>
        </Box>
      )}

      {messages.map((message, index) => (
        <MessageComponent
          key={index}
          message={message}
          toolDisplayMode={toolDisplayMode}
        />
      ))}

      {isGenerating && (
        <Box marginBottom={1}>
          <Spinner type="dots" />
          <Text color="yellow"> Thinking...</Text>
        </Box>
      )}

      {setupStatus === 'ready' && (
        <Box marginTop={1} width="100%">
          <MultiLineInput
            mode={inputMode}
            onModeChange={setInputMode}
            content={inputContent}
            cursorPosition={inputCursor}
            onContentChange={setInputContent}
            onCursorChange={setInputCursor}
            onSubmit={handleSubmit}
            placeholder={isGenerating ? "Generating response..." : "Type your message..."}
            maxHeight={6}
          />
        </Box>
      )}
    </Box>
  );
}

/**
 * Chat header component
 */
function ChatHeader({ config, setupStatus, setupMessage }: ChatHeaderProps): React.ReactElement {
  const title = config.title || 'Chat Session';

  if (setupStatus === 'ready') {
    return (
      <Box marginBottom={1}>
        <Text color="cyan">{title}</Text>
        <Text color="gray"> ({config.model_config?.model || 'Unknown Model'})</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="cyan">{title}</Text>
        <Text color="gray"> ({config.model_config?.model || 'Unknown Model'})</Text>
      </Box>
      <Box>
        <Spinner type="dots" />
        <Text color="yellow"> {setupMessage}</Text>
      </Box>
    </Box>
  );
}

/**
 * Message component
 */
function MessageComponent({ message, toolDisplayMode }: MessageComponentProps): React.ReactElement | null {
  const { role, content, status } = message;

  if (role === 'tool' && toolDisplayMode === 'hidden') {
    return null;
  }

  if (role === 'system' && (content.includes('Type your') || content.includes('Starting with'))) {
    return null;
  }

  const contentColor = {
    user: 'gray',
    assistant: 'white',
    system: 'gray',
    tool: 'magenta'
  }[role] || 'white';

  return (
    <Box flexDirection="column">
      {content && (
        <Box marginBottom={1}>
          <FormattedContent
            content={content}
            role={role}
            toolDisplayMode={toolDisplayMode}
            contentColor={contentColor}
            message={message}
          />
        </Box>
      )}
    </Box>
  );
}

/**
 * Formatted content component
 */
function FormattedContent({ content, role, toolDisplayMode, contentColor, message }: FormattedContentProps): React.ReactElement {
  if (role === 'tool' && toolDisplayMode === 'minimal') {
    const args = message.toolArgs ? message.toolArgs.join(' ') : '';
    return (
      <Box>
        <Text color="magenta" dimColor>
          {message.toolName}: {args}
        </Text>
      </Box>
    );
  }

  const lines = content.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <Text key={index} color={contentColor}>{line || ' '}</Text>
      ))}
    </Box>
  );
}

/**
 * Render the app and handle cleanup
 */
export async function renderApp(theaterClient: TheaterClient, actorId: string, config: ChatConfig, initialMessage?: string): Promise<void> {
  let app: Instance | null = null;

  const cleanup = async (): Promise<void> => {
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

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import chalk from 'chalk';

/**
 * Main application component
 */
function GitAssistantApp({ theaterClient, actorId, config, workflow }) {
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
    loading_actor: 'Loading git assistant actor...',
    ready: workflow
      ? `Running workflow: ${workflow.title}`
      : 'Type your git-related questions or commands.',
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

                // Start loading for assistant response
                setIsLoading(true);
                return;
              }

              // First process regular text content (assistant responses)
              const textContent = extractTextContent(parsedMessage);
              if (textContent && textContent.trim()) {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: textContent,
                  status: 'complete'
                }]);
              }

              // Then check for tool messages and add them after
              const toolMessages = parseToolMessages(parsedMessage);

              // Add tool messages based on display mode
              if (toolDisplayMode !== 'hidden') {
                toolMessages.forEach(toolMsg => {
                  setMessages(prev => [...prev, { ...toolMsg, status: 'complete' }]);
                });
              }

              setIsLoading(false);
            }
          } catch (error) {
            console.error('Error processing message:', error);
            setMessages(prev => [...prev, {
              role: 'system',
              content: `Error processing message: ${error.message}`,
              status: 'complete'
            }]);
            setIsLoading(false);
          }
        });



      } catch (error) {
        console.error('Setup error:', error);
        setSetupStatus('error');
        setSetupMessage(`${setupSteps.error}: ${error.message}`);

        // Auto-retry after 3 seconds
        setupTimeout = setTimeout(() => {
          setupChannel();
        }, 3000);
      }
    }

    setupChannel();

    return () => {
      if (setupTimeout) clearTimeout(setupTimeout);
    };

    // Cleanup function
    return () => {
      if (channel) {
        channel.close();
      }
    };
  }, [theaterClient, actorId]);

  // Auto-send workflow prompt when channel is ready (only once)
  useEffect(() => {
    async function sendWorkflowPrompt() {
      if (channel && workflow) {
        // Add the workflow message to the UI
        const workflowMessage = `🚀 ${workflow.title}: ${workflow.prompt}`;
        addMessage('user', workflowMessage, 'pending');
        // Don't set loading yet - wait for confirmation

        try {
          await channel.sendMessage(workflow.prompt);
        } catch (error) {
          addMessage('system', `Error sending workflow prompt: ${error.message}`);
          setIsLoading(false);
        }
      }
    }

    sendWorkflowPrompt();
  }, [channel, workflow]); // Remove isLoading and addMessage from dependencies to prevent loop

  const handleSubmit = useCallback(async (value) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) return;

    // Handle special commands
    if (trimmedValue === 'exit' || trimmedValue === 'quit') {
      exit();
      return;
    }

    if (trimmedValue === '/tools') {
      // Cycle through tool display modes
      const modes = ['hidden', 'minimal', 'full'];
      const currentIndex = modes.indexOf(toolDisplayMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      setToolDisplayMode(nextMode);
      // Tool display mode changed silently
      return;
    }

    if (trimmedValue === '/help') {
      setShowInstructions(!showInstructions);
      return;
    }

    // Add user message in pending state
    addMessage('user', trimmedValue, 'pending');
    setInputValue('');
    // Don't set loading yet - wait for confirmation from actor

    try {
      if (channel) {
        await channel.sendMessage(trimmedValue);
      } else {
        addMessage('system', 'Channel not ready, please wait...');
        setIsLoading(false);
      }
    } catch (error) {
      addMessage('system', `Error sending message: ${error.message}`);
      setIsLoading(false);
    }
  }, [channel, addMessage, exit, toolDisplayMode, showInstructions]);

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
    if (key.ctrl && input === 't') {
      // Quick toggle for tool display
      const modes = ['hidden', 'minimal', 'full'];
      const currentIndex = modes.indexOf(toolDisplayMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      setToolDisplayMode(nextMode);
      // Tool display mode changed silently
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header with repository info and setup status - only show during setup */}
      {setupStatus !== 'ready' && (
        <GitContextHeader config={config} setupStatus={setupStatus} setupMessage={setupMessage} />
      )}

      {/* Main chat area */}
      <Box flexDirection="column" flexGrow={1}>
        <ChatMessages messages={messages} toolDisplayMode={toolDisplayMode} />

        {/* Input area - only show when ready */}
        {setupStatus === 'ready' && (
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )}


        {setupStatus === 'ready' && showInstructions && <InstructionsFooter toolDisplayMode={toolDisplayMode} />}
      </Box>
    </Box>
  );
}

/**
 * Instructions footer component
 */
function InstructionsFooter({ toolDisplayMode }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="cyan">Commands: /tools (toggle: {toolDisplayMode}) | /help (hide) | exit</Text>
      <Text color="cyan">Shortcuts: Ctrl+C (exit) | Ctrl+T (toggle tools)</Text>
    </Box>
  );
}

/**
 * Git context header component
 */
function GitContextHeader({ config, setupStatus, setupMessage }) {
  const { gitContext } = config;

  return (
    <Box borderStyle="round" borderColor="blue" padding={1} marginBottom={1}>
      <Box flexDirection="column" width="100%">
        <Box justifyContent="space-between">
          <Text color="cyan">🎭 Git Assistant</Text>
          <Text color="gray">{gitContext.branch}</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color="gray">Repository: {gitContext.repository ? gitContext.repository.split('/').pop() : config.title.replace('Git Assistant - ', '')}</Text>
          <Text color="gray">Status: {gitContext.status}</Text>
        </Box>

        {/* Setup status indicator */}
        {setupStatus !== 'ready' && (
          <Box marginTop={1}>
            <Text color={setupStatus === 'error' ? 'red' : 'yellow'}>
              {setupStatus === 'error' ? '❌' : '⏳'} {setupMessage}
              {setupStatus === 'error' && <Text color="gray"> (retrying in 3s...)</Text>}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * Chat messages display component
 */
function ChatMessages({ messages, toolDisplayMode }) {
  return (
    <Box flexDirection="column" minHeight={10}>
      {messages.slice(-20).map((msg, i) => (
        <ChatMessage key={i} message={msg} toolDisplayMode={toolDisplayMode} />
      ))}
    </Box>
  );
}

/**
 * Individual chat message component
 */
function ChatMessage({ message, toolDisplayMode }) {
  const getMessageStyle = (role, status) => {
    const isPending = status === 'pending';
    switch (role) {
      case 'user':
        return {
          color: isPending ? 'gray' : 'gray',
          prefix: '',
          dimColor: isPending
        };
      case 'assistant':
        return { color: 'white', prefix: '' };
      case 'system':
        return { color: 'yellow', prefix: '' };
      case 'tool_use':
        return { color: 'magenta', prefix: '' };
      case 'tool_result':
        return { color: 'blue', prefix: '' };
      default:
        return { color: 'white', prefix: '' };
    }
  };

  const { color, prefix, dimColor } = getMessageStyle(message.role, message.status);

  // Handle tool use messages
  if (message.role === 'tool_use') {
    if (toolDisplayMode === 'hidden') return null;

    if (toolDisplayMode === 'minimal') {
      // Show first 50 chars of the input object (from the full content)
      //const inputContent = message.content || '';
      //const inputStr = inputContent.slice(0, 10);
      //const displayText = inputContent.length > 50 ? inputStr + '...' : inputStr;

      const args = message.toolArgs ? message.toolArgs.join(' ') : '';
      const displayText = `${message.functionName} ${args}`.trim();

      return (
        <Box>
          <Text color={color} dimColor>
            {message.toolName}: {args}
          </Text>
        </Box>
      );
    }

    // Full mode
    return (
      <Box flexDirection="column">
        <Text color={color}>
          {message.toolName} {message.toolArgs ? message.toolArgs.join(' ') : ''}
        </Text>
        {message.content && (
          <Box marginLeft={2} borderStyle="single" borderColor="magenta" padding={1}>
            <Text color="gray">{message.content}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Handle tool result messages
  if (message.role === 'tool_result') {
    if (toolDisplayMode === 'hidden') return null;

    if (toolDisplayMode === 'minimal') {
      // Show just a summary for minimal mode
      const summary = getResultSummary(message.content, message.toolName);
      return (
        <Box>
          <Text color={color} dimColor>
            {summary}
          </Text>
        </Box>
      );
    }

    // Full mode
    return (
      <Box flexDirection="column">
        <Text color={color}>
          Tool Result:
        </Text>
        <Box marginLeft={2} borderStyle="single" borderColor="gray" padding={1}>
          <FormattedOutput content={message.content} toolName={message.toolName} />
        </Box>
      </Box>
    );
  }

  // Regular messages
  return (
    <Box>
      <Text color={color} dimColor={dimColor}>
        {message.content}
        {message.status === 'pending' && (
          <Text color="gray"> (sending...)</Text>
        )}
      </Text>
    </Box>
  );
}

/**
 * Get a summary of tool results for minimal display
 */
function getResultSummary(content, toolName) {
  if (!content) return 'No output';

  const lines = content.split('\n').filter(line => line.trim());
  const firstLine = lines[0] || '';

  // Specific summaries for different tools
  if (toolName === 'git-command') {
    if (content.includes('nothing to commit')) return 'Working tree clean';
    if (content.includes('On branch')) return `On branch ${firstLine.split(' ').pop()}`;
    if (content.includes('commit ')) return `${lines.length} commits shown`;
    if (content.includes('diff --git')) return `Diff for ${lines.filter(l => l.startsWith('diff --git')).length} files`;
    if (content.includes('Changes not staged')) return 'Unstaged changes detected';
    if (content.includes('Changes to be committed')) return 'Staged changes detected';
  }

  // Generic summary
  if (lines.length === 1) return firstLine.slice(0, 50) + (firstLine.length > 50 ? '...' : '');
  return `${lines.length} lines of output`;
}

/**
 * Formatted output component for tool results
 */
function FormattedOutput({ content, toolName }) {
  // Handle git diff output with ANSI colors
  if (toolName === 'git-command' && content.includes('diff --git')) {
    return <GitDiffOutput content={content} />;
  }

  // Handle git status with colors
  if (toolName === 'git-command' && (content.includes('On branch') || content.includes('nothing to commit'))) {
    return <GitStatusOutput content={content} />;
  }

  // Handle git log with colors
  if (toolName === 'git-command' && content.includes('commit ')) {
    return <GitLogOutput content={content} />;
  }

  // Default: preserve any ANSI escape codes
  return <AnsiText>{content}</AnsiText>;
}

/**
 * Component to render ANSI colored text
 */
function AnsiText({ children }) {
  // This is a simplified version - you might want to use a proper ANSI parser
  const text = children || '';

  // Remove ANSI escape codes for now (could be enhanced to interpret them)
  const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');

  return <Text>{cleanText}</Text>;
}

/**
 * Git diff output component
 */
function GitDiffOutput({ content }) {
  const lines = content.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        let color = 'white';
        if (line.startsWith('+')) color = 'green';
        else if (line.startsWith('-')) color = 'red';
        else if (line.startsWith('@@')) color = 'cyan';
        else if (line.startsWith('diff --git')) color = 'yellow';

        return (
          <Text key={i} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}

/**
 * Git status output component
 */
function GitStatusOutput({ content }) {
  const lines = content.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        let color = 'white';
        if (line.includes('modified:')) color = 'yellow';
        else if (line.includes('new file:')) color = 'green';
        else if (line.includes('deleted:')) color = 'red';
        else if (line.includes('On branch')) color = 'cyan';

        return (
          <Text key={i} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}

/**
 * Git log output component
 */
function GitLogOutput({ content }) {
  const lines = content.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        let color = 'white';
        if (line.includes('commit ')) color = 'yellow';
        else if (line.includes('Author:')) color = 'cyan';
        else if (line.includes('Date:')) color = 'green';

        return (
          <Text key={i} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}

/**
 * Chat input component
 */
function ChatInput({ value, onChange, onSubmit, isLoading }) {
  return (
    <Box flexDirection="row" width="100%">
      <Text color="gray">git&gt; </Text>
      {isLoading ? (
        <Box marginLeft={1}>
          <Spinner type="dots" />
          <Text color="gray"> Processing...</Text>
        </Box>
      ) : (
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="Type your git question or command..."
        />
      )}
    </Box>
  );
}

/**
 * Extract text content from Theater message structure
 */
function extractTextContent(parsedMessage) {
  // Handle completion messages
  if (parsedMessage.message?.entry?.Completion?.content) {
    const content = parsedMessage.message.entry.Completion.content;
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('');
  }

  // Handle regular messages
  if (parsedMessage.message?.entry?.Message?.content) {
    const content = parsedMessage.message.entry.Message.content;
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('');
  }

  return '';
}

/**
 * Parse tool messages from Theater message structure
 */
function parseToolMessages(parsedMessage) {
  const toolMessages = [];

  // Handle completion messages that might contain tool_use
  if (parsedMessage.message?.entry?.Completion?.content) {
    const content = parsedMessage.message.entry.Completion.content;

    for (const item of content) {
      if (item.type === 'tool_use') {
        const toolMessage = {
          role: 'tool_use',
          toolName: item.name,
          toolArgs: item.input?.args || [],
          functionName: item.input?.function || item.input?.command || item.input?.args?.[0],
          content: JSON.stringify(item.input, null, 2)
        };
        toolMessages.push(toolMessage);

        // Store the last tool name for linking with results
        parseToolMessages.lastToolName = item.name;
      }
    }
  }

  // Handle user messages that might contain tool_result
  if (parsedMessage.message?.entry?.Message?.content) {
    const content = parsedMessage.message.entry.Message.content;

    for (const item of content) {
      if (item.type === 'tool_result') {
        const resultText = item.content
          ?.filter(c => c.type === 'text')
          ?.map(c => c.text)
          ?.join('\n') || '';

        toolMessages.push({
          role: 'tool_result',
          toolName: parseToolMessages.lastToolName || 'unknown',
          content: resultText.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
        });
      }
    }
  }

  return toolMessages;
}

// Static property to track last tool name
parseToolMessages.lastToolName = null;

/**
 * Render the application
 */
export async function renderApp(theaterClient, actorId, config, workflow = null) {
  const { waitUntilExit } = render(
    <GitAssistantApp
      theaterClient={theaterClient}
      actorId={actorId}
      config={config}
      workflow={workflow}
    />
  );

  // Wait for the app to exit
  await waitUntilExit();

  // Clean up - stop the actor we started
  console.log(chalk.redBright(`Cleaning up actor: ${actorId}`));
  try {
    await theaterClient.stopActor(actorId);
    console.log(chalk.redBright(`Actor ${actorId} stopped successfully`));
  } catch (error) {
    console.error(chalk.red(`Failed to stop actor ${actorId}: ${error.message}`));
  }
}

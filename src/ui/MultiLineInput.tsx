/**
 * MultiLineInput - advanced multi-line input with vim-style editing (from theater-chat)
 */

import { Box, Text, useInput } from 'ink';
import { useCallback, useState } from 'react';

export interface MultiLineInputProps {
  placeholder?: string;
  onSubmit: (content: string) => void;
  maxHeight?: number;
  mode?: 'insert' | 'command';
  onModeChange?: (mode: 'insert' | 'command') => void;
  content?: string;
  cursorPosition?: number;
  onContentChange?: (content: string) => void;
  onCursorChange?: (position: number) => void;
  disabled?: boolean;
  verbose?: boolean;
}

const HELP_COMMANDS = {
  command: {
    navigation: {
      'H': 'Move left',
      'j': 'Move down',
      'k': 'Move up',
      'l': 'Move right',
      '0': 'Beginning of line',
      '$': 'End of line',
      'w': 'Next word',
      'b': 'Previous word',
      '↑↓←→': 'Arrow keys'
    },
    editing: {
      'i': 'Insert at cursor',
      'a': 'Insert after cursor',
      'I': 'Insert at line start',
      'A': 'Insert at line end',
      'o': 'New line below',
      'O': 'New line above'
    },
    other: {
      'Enter': 'Submit message',
      'h': 'Toggle help'
    }
  },
  insert: {
    editing: {
      'Type': 'Insert text',
      'Enter': 'New line',
      'Backspace': 'Delete previous',
      '↑↓←→': 'Navigate'
    },
    other: {
      'Esc': 'Command mode',
      'Ctrl+Enter': 'Submit message',
      'Ctrl+h': 'Toggle help',
      'F1': 'Toggle help'
    }
  }
};

function HelpPanel({ mode }: { mode: 'insert' | 'command' }) {
  const commands = HELP_COMMANDS[mode];
  const modeColor = mode === 'insert' ? 'green' : 'blue';
  const modeTitle = mode === 'insert' ? 'Insert Mode' : 'Command Mode';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={modeColor}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      width="100%"
    >
      <Text color={modeColor} bold>
        {modeTitle} Help
      </Text>
      <Text color="gray" dimColor>
        Help overlay - continue editing normally
      </Text>

      {Object.entries(commands).map(([sectionName, sectionCommands]) => (
        <Box key={sectionName} flexDirection="column" marginTop={1}>
          <Text color="yellow" bold>
            {sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}:
          </Text>
          {Object.entries(sectionCommands).map(([key, desc]) => (
            <Text key={key}>
              <Text color="cyan">{key.padEnd(10)}</Text>
              <Text color="white">{desc}</Text>
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Advanced multi-line input with vim-style modal editing and cursor management
 */
export function MultiLineInput({
  placeholder = 'Type your message...',
  onSubmit,
  maxHeight = 6,
  mode = 'insert',
  onModeChange,
  content = '',
  cursorPosition = 0,
  onContentChange,
  onCursorChange,
  disabled = false,
  verbose = false
}: MultiLineInputProps) {

  // Use internal state if not controlled
  const [internalContent, setInternalContent] = useState('');
  const [internalCursorPosition, setInternalCursorPosition] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Determine if we're in controlled mode
  const isControlled = onContentChange !== undefined;

  // Get current values (controlled or uncontrolled)
  const actualContent = isControlled ? content : internalContent;
  const actualCursorPosition = isControlled ? cursorPosition : internalCursorPosition;

  // Convert content to lines for display
  const lines = actualContent.split('\n');
  const isEmpty = actualContent.length === 0;

  // Find cursor row and column
  const getCursorLocation = useCallback((pos: number) => {
    const beforeCursor = actualContent.slice(0, pos);
    const row = beforeCursor.split('\n').length - 1;
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const col = lastNewline === -1 ? pos : pos - lastNewline - 1;
    return { row, col };
  }, [actualContent]);

  const { row: cursorRow, col: cursorCol } = getCursorLocation(actualCursorPosition);

  // Text manipulation functions
  const insertText = useCallback((text: string) => {
    if (disabled) return;

    const before = actualContent.slice(0, actualCursorPosition);
    const after = actualContent.slice(actualCursorPosition);
    const newContent = before + text + after;
    const newCursor = actualCursorPosition + text.length;

    if (isControlled) {
      onContentChange?.(newContent);
      onCursorChange?.(newCursor);
    } else {
      setInternalContent(newContent);
      setInternalCursorPosition(newCursor);
    }
  }, [actualContent, actualCursorPosition, onContentChange, onCursorChange, disabled, isControlled]);

  const deleteChar = useCallback((direction: 'forward' | 'backward' = 'backward') => {
    if (disabled) return;

    if (direction === 'backward' && actualCursorPosition > 0) {
      const before = actualContent.slice(0, actualCursorPosition - 1);
      const after = actualContent.slice(actualCursorPosition);
      const newContent = before + after;
      const newCursor = actualCursorPosition - 1;

      if (isControlled) {
        onContentChange?.(newContent);
        onCursorChange?.(newCursor);
      } else {
        setInternalContent(newContent);
        setInternalCursorPosition(newCursor);
      }
    } else if (direction === 'forward' && actualCursorPosition < actualContent.length) {
      const before = actualContent.slice(0, actualCursorPosition);
      const after = actualContent.slice(actualCursorPosition + 1);
      const newContent = before + after;

      if (isControlled) {
        onContentChange?.(newContent);
        // Cursor stays same for forward delete
      } else {
        setInternalContent(newContent);
        // Cursor stays same for forward delete
      }
    }
  }, [actualContent, actualCursorPosition, onContentChange, onCursorChange, disabled, isControlled]);

  const moveCursor = useCallback((newPos: number) => {
    if (disabled) return;
    const clampedPos = Math.max(0, Math.min(actualContent.length, newPos));

    if (isControlled) {
      onCursorChange?.(clampedPos);
    } else {
      setInternalCursorPosition(clampedPos);
    }
  }, [actualContent.length, onCursorChange, disabled, isControlled]);

  const handleSubmit = useCallback((): void => {
    if (disabled) return;
    const trimmed = actualContent.trim();
    if (trimmed) {
      onSubmit(trimmed);
      // Clear the input after successful submission
      if (isControlled) {
        onContentChange?.('');
        onCursorChange?.(0);
      } else {
        setInternalContent('');
        setInternalCursorPosition(0);
      }
    }
  }, [actualContent, onSubmit, onContentChange, onCursorChange, disabled, isControlled]);

  // Key input handler
  useInput((input: string, key: any) => {
    if (verbose) {
      console.log('[DEBUG MultiLineInput] Input received:', { input, key, disabled });
    }
    if (disabled) return;

    if (key.escape) {
      // Escape always goes to command mode, but doesn't close help
      onModeChange?.('command');
      return;
    }

    // F1 key can toggle help from any mode
    if (key.f1) {
      setShowHelp(!showHelp);
      return;
    }

    // Handle return key for both modes
    if (key.return) {
      if (key.ctrl) {
        // Ctrl+Enter submits in any mode
        handleSubmit();
        return;
      }
      if (mode === 'command') {
        // In command mode, plain Return submits
        handleSubmit();
        return;
      } else if (mode === 'insert') {
        // In insert mode, Return adds newline
        insertText('\n');
        return;
      }
    }

    // Command mode key handling
    if (mode === 'command') {
      // Help command
      if (input === 'h') {
        setShowHelp(!showHelp);
        return;
      }

      // Vim-style navigation (h is now help, so we'll use H for left or rely on arrow keys)
      if (input === 'H') {
        // H - move left (since h is now help)
        moveCursor(actualCursorPosition - 1);
        return;
      }
      if (input === 'j') {
        // j - move down
        const currentLineEnd = actualContent.indexOf('\n', actualCursorPosition);
        if (currentLineEnd !== -1) {
          const nextLineEnd = actualContent.indexOf('\n', currentLineEnd + 1);
          const targetCol = cursorCol;
          const nextLineStart = currentLineEnd + 1;
          const nextLineLength = nextLineEnd !== -1 ? nextLineEnd - nextLineStart : actualContent.length - nextLineStart;
          const newPos = nextLineStart + Math.min(targetCol, nextLineLength);
          moveCursor(newPos);
        }
        return;
      }
      if (input === 'l') {
        // l - move right
        moveCursor(actualCursorPosition + 1);
        return;
      }
      if (input === 'k') {
        // k - move up
        const currentLineStart = actualContent.lastIndexOf('\n', actualCursorPosition - 1);
        const prevLineStart = currentLineStart > 0 ? actualContent.lastIndexOf('\n', currentLineStart - 1) : -1;
        if (prevLineStart !== -1) {
          const targetCol = cursorCol;
          const prevLineEnd = currentLineStart;
          const prevLineLength = prevLineEnd - prevLineStart - 1;
          const newPos = prevLineStart + 1 + Math.min(targetCol, prevLineLength);
          moveCursor(newPos);
        }
        return;
      }

      // Vim-style line navigation
      if (input === '0') {
        // 0 - move to beginning of line
        const currentLineStart = actualContent.lastIndexOf('\n', actualCursorPosition - 1);
        const lineStart = currentLineStart === -1 ? 0 : currentLineStart + 1;
        moveCursor(lineStart);
        return;
      }
      if (input === '$') {
        // $ - move to end of line
        const currentLineEnd = actualContent.indexOf('\n', actualCursorPosition);
        const lineEnd = currentLineEnd === -1 ? actualContent.length : currentLineEnd;
        moveCursor(lineEnd);
        return;
      }

      // More vim-style commands
      if (input === 'w') {
        // w - move to next word
        const rest = actualContent.slice(actualCursorPosition);
        const wordMatch = rest.match(/\s*\S+\s*/);
        if (wordMatch) {
          moveCursor(actualCursorPosition + wordMatch[0].length);
        }
        return;
      }
      if (input === 'b') {
        // b - move to previous word
        const before = actualContent.slice(0, actualCursorPosition);
        const reversed = before.split('').reverse().join('');
        const wordMatch = reversed.match(/\s*\S+/);
        if (wordMatch) {
          moveCursor(actualCursorPosition - wordMatch[0].length);
        }
        return;
      }

      // Insert mode commands
      if (input === 'i') {
        // i - enter insert mode at cursor
        onModeChange?.('insert');
        return;
      }
      if (input === 'a') {
        // a - enter insert mode after cursor
        moveCursor(actualCursorPosition + 1);
        onModeChange?.('insert');
        return;
      }
      if (input === 'A') {
        // A - enter insert mode at end of line
        const currentLineEnd = actualContent.indexOf('\n', actualCursorPosition);
        const lineEnd = currentLineEnd === -1 ? actualContent.length : currentLineEnd;
        moveCursor(lineEnd);
        onModeChange?.('insert');
        return;
      }
      if (input === 'I') {
        // I - enter insert mode at beginning of line
        const currentLineStart = actualContent.lastIndexOf('\n', actualCursorPosition - 1);
        const lineStart = currentLineStart === -1 ? 0 : currentLineStart + 1;
        moveCursor(lineStart);
        onModeChange?.('insert');
        return;
      }
      if (input === 'o') {
        // o - open new line below and enter insert mode
        const currentLineEnd = actualContent.indexOf('\n', actualCursorPosition);
        const insertPos = currentLineEnd === -1 ? actualContent.length : currentLineEnd;
        const before = actualContent.slice(0, insertPos);
        const after = actualContent.slice(insertPos);
        const newContent = before + '\n' + after;
        const newCursor = insertPos + 1;

        if (isControlled) {
          onContentChange?.(newContent);
          onCursorChange?.(newCursor);
        } else {
          setInternalContent(newContent);
          setInternalCursorPosition(newCursor);
        }
        onModeChange?.('insert');
        return;
      }
      if (input === 'O') {
        // O - open new line above and enter insert mode
        const currentLineStart = actualContent.lastIndexOf('\n', actualCursorPosition - 1);
        const insertPos = currentLineStart === -1 ? 0 : currentLineStart + 1;
        const before = actualContent.slice(0, insertPos);
        const after = actualContent.slice(insertPos);
        const newContent = before + '\n' + after;
        const newCursor = insertPos;

        if (isControlled) {
          onContentChange?.(newContent);
          onCursorChange?.(newCursor);
        } else {
          setInternalContent(newContent);
          setInternalCursorPosition(newCursor);
        }
        onModeChange?.('insert');
        return;
      }

      // Arrow keys still work in command mode
      if (key.leftArrow) {
        moveCursor(actualCursorPosition - 1);
        return;
      }
      if (key.rightArrow) {
        moveCursor(actualCursorPosition + 1);
        return;
      }

      // Ignore other input in command mode
      return;
    }

    // Insert mode: Regular characters
    if (input && !key.ctrl && !key.meta) {
      insertText(input);
      return;
    }

    // Ctrl+h can toggle help in insert mode
    if (key.ctrl && input === 'h') {
      setShowHelp(!showHelp);
      return;
    }

    // Insert mode only: Arrow key navigation
    if (key.leftArrow) {
      moveCursor(actualCursorPosition - 1);
      return;
    }
    if (key.rightArrow) {
      moveCursor(actualCursorPosition + 1);
      return;
    }

    // Up/down arrow navigation
    if (key.upArrow) {
      const currentLineStart = actualContent.lastIndexOf('\n', actualCursorPosition - 1);
      const prevLineStart = currentLineStart > 0 ? actualContent.lastIndexOf('\n', currentLineStart - 1) : -1;
      if (prevLineStart !== -1) {
        const targetCol = cursorCol;
        const prevLineEnd = currentLineStart;
        const prevLineLength = prevLineEnd - prevLineStart - 1;
        const newPos = prevLineStart + 1 + Math.min(targetCol, prevLineLength);
        moveCursor(newPos);
      }
      return;
    }
    if (key.downArrow) {
      const currentLineEnd = actualContent.indexOf('\n', actualCursorPosition);
      if (currentLineEnd !== -1) {
        const nextLineEnd = actualContent.indexOf('\n', currentLineEnd + 1);
        const targetCol = cursorCol;
        const nextLineStart = currentLineEnd + 1;
        const nextLineLength = nextLineEnd !== -1 ? nextLineEnd - nextLineStart : actualContent.length - nextLineStart;
        const newPos = nextLineStart + Math.min(targetCol, nextLineLength);
        moveCursor(newPos);
      }
      return;
    }

    // Delete (insert mode only)
    if (key.backspace || key.delete) {
      deleteChar('backward');
      return;
    }
  });

  // Render
  const displayLines = lines.slice(0, maxHeight);
  const hasMoreLines = lines.length > maxHeight;

  return (
    <Box flexDirection="column" width="100%">
      {showHelp && (
        <Box marginBottom={1}>
          <HelpPanel mode={mode} />
        </Box>
      )}
      <Box
        borderStyle="round"
        borderColor={disabled ? "gray" : "gray"}
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
        minHeight={3}
        width="100%"
      >
        <Box flexDirection="column">
          {isEmpty ? (
            <Text>
              <Text backgroundColor="white" color="black"> </Text>
              <Text color="gray">{placeholder}</Text>
            </Text>
          ) : (
            displayLines.map((line, index) => {
              const isCurrentLine = index === cursorRow && cursorRow < maxHeight;

              if (!isCurrentLine) {
                // Ensure empty lines render as visible empty lines
                return <Text key={index}>{line.length === 0 ? ' ' : line}</Text>;
              }

              const beforeCursor = line.slice(0, cursorCol);
              const atCursor = cursorCol < line.length ? line[cursorCol] : ' ';
              const afterCursor = cursorCol < line.length ? line.slice(cursorCol + 1) : '';

              return (
                <Text key={index}>
                  {beforeCursor}
                  <Text
                    backgroundColor={disabled ? "gray" : (mode === 'command' ? "blue" : "white")}
                    color={mode === 'command' ? "white" : "black"}
                  >
                    {atCursor}
                  </Text>
                  {afterCursor}
                </Text>
              );
            })
          )}

          {hasMoreLines && (
            <Text color="gray" dimColor>
              ... {lines.length - maxHeight} more lines
            </Text>
          )}
        </Box>
      </Box>

      <Box justifyContent="space-between">
        <Text color={mode === 'insert' ? 'green' : 'blue'} dimColor>
          {mode?.toUpperCase() || 'INSERT'}
          {showHelp && ' + HELP'}
        </Text>
        <Text color="gray" dimColor>
          Line {cursorRow + 1}, Col {cursorCol + 1}
          {lines.length > 1 && ` • ${lines.length} lines`}
          {!isEmpty && ` • ${content.length} chars`}
          {showHelp && ' • h to toggle help'}
        </Text>
      </Box>
    </Box>
  );
}

import React, { useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import fs from 'fs';
import path from 'path';

// Set up input-specific logging
const inputLogFile = path.join(process.cwd(), 'input-box.log');

function logInput(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}\n`;
  try {
    fs.appendFileSync(inputLogFile, logMessage);
  } catch (error) {
    // Fail silently for logging errors
  }
}

// Initialize log file
try {
  fs.writeFileSync(inputLogFile, `=== MultiLineInput logging started at ${new Date().toISOString()} ===\n`);
} catch (error) {
  // Fail silently
}

/**
 * Multi-line text input - fully controlled by parent
 * Simple, reliable, no race conditions!
 */
export default function MultiLineInput({
  placeholder = 'Type your message...',
  onSubmit,
  maxHeight = 6,
  mode = 'insert',
  onModeChange,
  content = '',
  cursorPosition = 0,
  onContentChange,
  onCursorChange
}) {
  const { stdout } = useStdout();
  logInput(`Render: content="${content}", cursor=${cursorPosition}`);

  // Convert content to lines for display
  const lines = content.split('\n');
  const isEmpty = content.length === 0;

  // Find cursor row and column
  const getCursorLocation = useCallback((pos) => {
    const beforeCursor = content.slice(0, pos);
    const row = beforeCursor.split('\n').length - 1;
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const col = lastNewline === -1 ? pos : pos - lastNewline - 1;
    return { row, col };
  }, [content]);

  const { row: cursorRow, col: cursorCol } = getCursorLocation(cursorPosition);

  // Simple operations that just call parent callbacks
  const insertText = useCallback((text) => {
    logInput(`Insert: "${text}" at ${cursorPosition}`);
    const before = content.slice(0, cursorPosition);
    const after = content.slice(cursorPosition);
    const newContent = before + text + after;
    const newCursor = cursorPosition + text.length;

    onContentChange(newContent);
    onCursorChange(newCursor);
  }, [content, cursorPosition, onContentChange, onCursorChange]);

  const deleteChar = useCallback((direction = 'backward') => {
    logInput(`Delete: direction=${direction}, cursor=${cursorPosition}`);

    if (direction === 'backward' && cursorPosition > 0) {
      const before = content.slice(0, cursorPosition - 1);
      const after = content.slice(cursorPosition);
      const newContent = before + after;
      const newCursor = cursorPosition - 1;

      onContentChange(newContent);
      onCursorChange(newCursor);
    } else if (direction === 'forward' && cursorPosition < content.length) {
      const before = content.slice(0, cursorPosition);
      const after = content.slice(cursorPosition + 1);
      const newContent = before + after;

      onContentChange(newContent);
      // Cursor stays same for forward delete
    }
  }, [content, cursorPosition, onContentChange, onCursorChange]);

  const moveCursor = useCallback((newPos) => {
    const clampedPos = Math.max(0, Math.min(content.length, newPos));
    logInput(`Move cursor: ${cursorPosition} -> ${clampedPos}`);
    onCursorChange(clampedPos);
  }, [content.length, cursorPosition, onCursorChange]);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  }, [content, onSubmit]);

  // Key input handler
  useInput((input, key) => {
    logInput(`Key: input="${input}", key=${JSON.stringify(key)}`);

    if (key.escape) {
      onModeChange('normal');
      return;
    }

    if (mode !== 'insert') return;

    // Navigation
    if (key.leftArrow) {
      moveCursor(cursorPosition - 1);
      return;
    }
    if (key.rightArrow) {
      moveCursor(cursorPosition + 1);
      return;
    }
    if (key.home) {
      const lineStart = content.lastIndexOf('\n', cursorPosition - 1) + 1;
      moveCursor(lineStart);
      return;
    }
    if (key.end) {
      const lineEnd = content.indexOf('\n', cursorPosition);
      moveCursor(lineEnd === -1 ? content.length : lineEnd);
      return;
    }

    // Up/down arrow (simplified)
    if (key.upArrow) {
      const currentLineStart = content.lastIndexOf('\n', cursorPosition - 1);
      const prevLineStart = currentLineStart > 0 ? content.lastIndexOf('\n', currentLineStart - 1) : -1;
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
      const currentLineEnd = content.indexOf('\n', cursorPosition);
      if (currentLineEnd !== -1) {
        const nextLineEnd = content.indexOf('\n', currentLineEnd + 1);
        const targetCol = cursorCol;
        const nextLineStart = currentLineEnd + 1;
        const nextLineLength = nextLineEnd !== -1 ? nextLineEnd - nextLineStart : content.length - nextLineStart;
        const newPos = nextLineStart + Math.min(targetCol, nextLineLength);
        moveCursor(newPos);
      }
      return;
    }

    // Delete
    if (key.backspace || key.delete) {
      deleteChar('backward');
      return;
    }

    // Submit
    if (key.ctrl && key.return) {
      handleSubmit();
      return;
    }

    // Enter = newline
    if (key.return) {
      insertText('\n');
      return;
    }

    // Regular characters
    if (input && !key.ctrl && !key.meta) {
      insertText(input);
    }
  });

  // Render
  const displayLines = lines.slice(0, maxHeight);
  const hasMoreLines = lines.length > maxHeight;

  return (
    <Box flexDirection="column" width="100%">
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
        minHeight={3}
        width="80%"
      >
        <Box flexDirection="column">
          {isEmpty ? (
            <Text>
              <Text backgroundColor="white" color="black"> </Text>
              <Text color="gray" dimColor>{placeholder}</Text>
            </Text>
          ) : (
            displayLines.map((line, index) => {
              const isCurrentLine = index === cursorRow && cursorRow < maxHeight;

              if (!isCurrentLine) {
                return <Text key={index}>{line}</Text>;
              }

              const beforeCursor = line.slice(0, cursorCol);
              const atCursor = cursorCol < line.length ? line[cursorCol] : ' ';
              const afterCursor = cursorCol < line.length ? line.slice(cursorCol + 1) : '';

              return (
                <Text key={index}>
                  {beforeCursor}
                  <Text backgroundColor="white" color="black">
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
        <Text color="gray" dimColor>
          Line {cursorRow + 1}, Col {cursorCol + 1}
          {lines.length > 1 && ` • ${lines.length} lines`}
          {!isEmpty && ` • ${content.length} chars`}
        </Text>
        <Text color={mode === 'insert' ? 'green' : 'blue'} dimColor>
          {mode.toUpperCase()}
        </Text>
      </Box>
    </Box>
  );
}

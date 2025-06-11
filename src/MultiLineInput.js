import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Simplified multi-line text input component
 * 
 * Features:
 * - Enter adds newline, Ctrl+Enter submits
 * - Basic cursor navigation
 * - Simple and reliable
 */
export default function MultiLineInput({ 
  placeholder = 'Type your message...',
  onSubmit,
  maxHeight = 6,
  submitHint = "Ctrl+Enter to send"
}) {
  const [content, setContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

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

  // Insert text at cursor
  const insertText = useCallback((text) => {
    const before = content.slice(0, cursorPosition);
    const after = content.slice(cursorPosition);
    const newContent = before + text + after;
    setContent(newContent);
    setCursorPosition(cursorPosition + text.length);
  }, [content, cursorPosition]);

  // Delete character
  const deleteChar = useCallback((direction = 'backward') => {
    if (direction === 'backward' && cursorPosition > 0) {
      // Backspace
      const before = content.slice(0, cursorPosition - 1);
      const after = content.slice(cursorPosition);
      setContent(before + after);
      setCursorPosition(cursorPosition - 1);
    } else if (direction === 'forward' && cursorPosition < content.length) {
      // Delete
      const before = content.slice(0, cursorPosition);
      const after = content.slice(cursorPosition + 1);
      setContent(before + after);
      // Cursor position stays the same
    }
  }, [content, cursorPosition]);

  // Move cursor
  const moveCursor = useCallback((newPos) => {
    const clampedPos = Math.max(0, Math.min(content.length, newPos));
    setCursorPosition(clampedPos);
  }, [content.length]);

  // Clear input
  const clearInput = useCallback(() => {
    setContent('');
    setCursorPosition(0);
  }, []);

  // Submit handler
  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (trimmed) {
      onSubmit(trimmed);
      clearInput();
    }
  }, [content, onSubmit, clearInput]);

  // Key input handler
  useInput((input, key) => {
    // Submit on Ctrl+Enter
    if (key.ctrl && key.return) {
      handleSubmit();
      return;
    }

    // Navigation
    if (key.upArrow) {
      const currentLineStart = content.lastIndexOf('\n', cursorPosition - 1);
      const prevLineStart = currentLineStart > 0 ? 
        content.lastIndexOf('\n', currentLineStart - 1) : -1;
      
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
      const nextLineEnd = currentLineEnd !== -1 ? 
        content.indexOf('\n', currentLineEnd + 1) : -1;
      
      if (currentLineEnd !== -1) {
        const targetCol = cursorCol;
        const nextLineStart = currentLineEnd + 1;
        const nextLineLength = nextLineEnd !== -1 ? 
          nextLineEnd - nextLineStart : 
          content.length - nextLineStart;
        const newPos = nextLineStart + Math.min(targetCol, nextLineLength);
        moveCursor(newPos);
      }
      return;
    }

    if (key.leftArrow) {
      moveCursor(cursorPosition - 1);
      return;
    }

    if (key.rightArrow) {
      moveCursor(cursorPosition + 1);
      return;
    }

    // Home/End
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

    // Delete operations
    if (key.delete) {
      deleteChar('forward');
      return;
    }

    if (key.backspace) {
      deleteChar('backward');
      return;
    }

    // Enter: New line
    if (key.return) {
      insertText('\n');
      return;
    }

    // Escape: Clear input
    if (key.escape) {
      clearInput();
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      insertText(input);
    }
  });

  // Render lines with cursor
  const displayLines = lines.slice(0, maxHeight);
  const hasMoreLines = lines.length > maxHeight;

  return (
    <Box flexDirection="column">
      {/* Input area with border */}
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
        minHeight={3}
      >
        {/* Header */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text color="gray">Message</Text>
          <Text color="gray" dimColor>{submitHint}</Text>
        </Box>

        {/* Content */}
        <Box flexDirection="column">
          {isEmpty ? (
            <Text color="gray" dimColor>{placeholder}</Text>
          ) : (
            displayLines.map((line, index) => {
              const isCurrentLine = index === cursorRow && cursorRow < maxHeight;
              
              if (!isCurrentLine) {
                return <Text key={index}>{line}</Text>;
              }

              // Render line with cursor
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

      {/* Status */}
      <Text color="gray" dimColor>
        Line {cursorRow + 1}, Col {cursorCol + 1}
        {lines.length > 1 && ` • ${lines.length} lines`}
        {!isEmpty && ` • ${content.length} chars`}
      </Text>
    </Box>
  );
}

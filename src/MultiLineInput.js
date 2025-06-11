import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
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
 * Simplified multi-line text input component
 * 
 * Features:
 * - Enter adds newline, Ctrl+Enter submits
 * - Basic cursor navigation
 * - Simple and reliable
 * - Comprehensive logging for debugging
 */
export default function MultiLineInput({
  placeholder = 'Type your message...',
  onSubmit,
  maxHeight = 6,
  mode = 'insert', // 'insert' | 'normal'
  onModeChange,
  content = '',
  onContentChange
}) {
  const [cursorPosition, setCursorPosition] = useState(0);

  logInput(`MultiLineInput initialized with content length: ${content.length}, cursor at: ${cursorPosition}`);

  // Wrap onContentChange to debug when it's called
  const debugOnContentChange = useCallback((newContent) => {
    logInput(`Content change: "${content}" -> "${newContent}" (${content.length} -> ${newContent.length} chars)`);
    onContentChange(newContent);
  }, [onContentChange, content]);

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
    logInput(`Insert text: "${text}" at position ${cursorPosition}`);
    const before = content.slice(0, cursorPosition);
    const after = content.slice(cursorPosition);
    const newContent = before + text + after;
    const newCursorPos = cursorPosition + text.length;

    logInput(`Insert result: content "${content}" -> "${newContent}", cursor ${cursorPosition} -> ${newCursorPos}`);
    
    debugOnContentChange(newContent);
    setCursorPosition(newCursorPos);
  }, [content, cursorPosition, debugOnContentChange]);

  // Delete character
  const deleteChar = useCallback((direction = 'backward') => {
    logInput(`Delete character: direction=${direction}, cursor=${cursorPosition}, content="${content}"`);

    if (direction === 'backward' && cursorPosition > 0) {
      // Backspace
      const before = content.slice(0, cursorPosition - 1);
      const after = content.slice(cursorPosition);
      const newContent = before + after;
      const newCursorPos = cursorPosition - 1;

      logInput(`Backspace: "${content}" -> "${newContent}", cursor ${cursorPosition} -> ${newCursorPos}`);
      debugOnContentChange(newContent);
      setCursorPosition(newCursorPos);
    } else if (direction === 'forward' && cursorPosition < content.length) {
      // Delete
      const before = content.slice(0, cursorPosition);
      const after = content.slice(cursorPosition + 1);
      const newContent = before + after;

      logInput(`Forward delete: "${content}" -> "${newContent}", cursor stays at ${cursorPosition}`);
      debugOnContentChange(newContent);
      // Cursor position stays the same
    } else {
      logInput(`Delete ignored: direction=${direction}, cursor=${cursorPosition}, content.length=${content.length}`);
    }
  }, [content, cursorPosition, debugOnContentChange]);

  // Move cursor
  const moveCursor = useCallback((newPos) => {
    const clampedPos = Math.max(0, Math.min(content.length, newPos));
    logInput(`Move cursor: ${cursorPosition} -> ${newPos} (clamped to ${clampedPos})`);
    setCursorPosition(clampedPos);
  }, [content.length, cursorPosition]);

  // Clear input
  const clearInput = useCallback(() => {
    logInput(`Clear input: "${content}" -> ""`);
    debugOnContentChange('');
    setCursorPosition(0);
  }, [debugOnContentChange, content]);

  // Submit handler
  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    logInput(`Submit attempt: content="${content}", trimmed="${trimmed}"`);
    if (trimmed) {
      onSubmit(trimmed);
      clearInput();
    }
  }, [content, onSubmit, clearInput]);

  // Key input handler - only active in INSERT mode
  useInput((input, key) => {
    logInput(`Key input: input="${input}", key=${JSON.stringify(key)}, mode=${mode}`);

    // Always handle Escape to switch to NORMAL mode
    if (key.escape) {
      logInput('Mode change: insert -> normal');
      onModeChange('normal');
      return;
    }

    // Only handle other keys in INSERT mode
    if (mode !== 'insert') {
      logInput('Key ignored - not in insert mode');
      return;
    }

    // Navigation
    if (key.upArrow) {
      logInput('Navigation: up arrow');
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
      logInput('Navigation: down arrow');
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
      logInput('Navigation: left arrow');
      moveCursor(cursorPosition - 1);
      return;
    }

    if (key.rightArrow) {
      logInput('Navigation: right arrow');
      moveCursor(cursorPosition + 1);
      return;
    }

    // Home/End
    if (key.home) {
      logInput('Navigation: home');
      const lineStart = content.lastIndexOf('\n', cursorPosition - 1) + 1;
      moveCursor(lineStart);
      return;
    }

    if (key.end) {
      logInput('Navigation: end');
      const lineEnd = content.indexOf('\n', cursorPosition);
      moveCursor(lineEnd === -1 ? content.length : lineEnd);
      return;
    }

    // Delete operations - FIX: Clearer handling of different delete keys
    if (key.backspace) {
      logInput('Delete: backspace key detected');
      deleteChar('backward');
      return;
    }

    // On Mac/terminal, key.delete might be the forward delete or might be the same as backspace
    // Let's be more explicit about this
    if (key.delete) {
      logInput('Delete: delete key detected');
      // Most terminals map "delete" key to backspace behavior
      // Forward delete is usually fn+delete which shows up differently
      deleteChar('backward');
      return;
    }

    // Alternative approach: check for forward delete specifically
    // This might show up as a different key combination
    if (key.ctrl && key.name === 'd') {
      logInput('Delete: Ctrl+D (forward delete)');
      deleteChar('forward');
      return;
    }

    // Enter: New line
    if (key.return) {
      logInput('Input: return/enter - adding newline');
      insertText('\n');
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      logInput(`Input: regular character "${input}"`);
      insertText(input);
      return;
    }

    // Log unhandled keys
    logInput(`Unhandled key: input="${input}", key=${JSON.stringify(key)}`);
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
          <Text color={mode === 'insert' ? 'green' : 'blue'}>
            ({mode.toUpperCase()})
          </Text>
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
                  <Text
                    backgroundColor={mode === 'normal' ? 'blue' : 'white'}
                    color={mode === 'normal' ? 'white' : 'black'}
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

      {/* Status */}
      <Text color="gray" dimColor>
        Line {cursorRow + 1}, Col {cursorCol + 1}
        {lines.length > 1 && ` • ${lines.length} lines`}
        {!isEmpty && ` • ${content.length} chars`}
      </Text>
    </Box>
  );
}

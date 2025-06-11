import React, { useState, useCallback, useEffect, useRef } from 'react';
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
 * Multi-line text input component with race condition fixes
 */
export default function MultiLineInput({
  placeholder = 'Type your message...',
  onSubmit,
  maxHeight = 6,
  mode = 'insert',
  onModeChange,
  content = '',
  onContentChange
}) {
  // Single state object to prevent race conditions
  const [inputState, setInputState] = useState({
    content: content,
    cursorPosition: 0
  });

  // Track if we need to notify parent of content changes
  const [pendingContentChange, setPendingContentChange] = useState(null);
  
  // Use ref to track if we initiated the content change (to avoid cursor reset)
  const initiatedChangeRef = useRef(false);

  // Sync with parent content changes (when parent updates content)
  useEffect(() => {
    // Only sync if the parent changed content AND we didn't initiate it
    if (inputState.content !== content && !initiatedChangeRef.current) {
      logInput(`Syncing with parent (external change): "${inputState.content}" -> "${content}"`);
      setInputState(prevState => ({
        content: content,
        cursorPosition: Math.min(prevState.cursorPosition, content.length)
      }));
    } else if (inputState.content !== content && initiatedChangeRef.current) {
      logInput(`Ignoring parent sync (we initiated change): "${inputState.content}" vs "${content}"`);
      // Reset the flag
      initiatedChangeRef.current = false;
    }
  }, [content, inputState.content]);

  // Notify parent of content changes (separate from state updates)
  useEffect(() => {
    if (pendingContentChange !== null) {
      logInput(`Notifying parent of content change: "${pendingContentChange}"`);
      initiatedChangeRef.current = true; // Mark that we're initiating this change
      onContentChange(pendingContentChange);
      setPendingContentChange(null);
    }
  }, [pendingContentChange, onContentChange]);

  // Convert content to lines for display
  const lines = inputState.content.split('\n');
  const isEmpty = inputState.content.length === 0;

  // Find cursor row and column
  const getCursorLocation = useCallback((pos, contentStr) => {
    const beforeCursor = contentStr.slice(0, pos);
    const row = beforeCursor.split('\n').length - 1;
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const col = lastNewline === -1 ? pos : pos - lastNewline - 1;
    return { row, col };
  }, []);

  const { row: cursorRow, col: cursorCol } = getCursorLocation(inputState.cursorPosition, inputState.content);

  // Insert text at cursor
  const insertText = useCallback((text) => {
    logInput(`Insert text: "${text}"`);
    
    setInputState(currentState => {
      const { content: currentContent, cursorPosition: currentCursor } = currentState;
      const before = currentContent.slice(0, currentCursor);
      const after = currentContent.slice(currentCursor);
      const newContent = before + text + after;
      const newCursorPos = currentCursor + text.length;

      logInput(`Insert: "${currentContent}" -> "${newContent}", cursor ${currentCursor} -> ${newCursorPos}`);
      
      // Schedule parent notification
      setPendingContentChange(newContent);
      
      return {
        content: newContent,
        cursorPosition: newCursorPos
      };
    });
  }, []);

  // Delete character
  const deleteChar = useCallback((direction = 'backward') => {
    logInput(`Delete attempt: direction=${direction}`);
    
    setInputState(currentState => {
      const { content: currentContent, cursorPosition: currentCursor } = currentState;
      
      logInput(`Delete with current state: content="${currentContent}", cursor=${currentCursor}`);

      if (direction === 'backward' && currentCursor > 0) {
        // Backspace
        const before = currentContent.slice(0, currentCursor - 1);
        const after = currentContent.slice(currentCursor);
        const newContent = before + after;
        const newCursorPos = currentCursor - 1;

        logInput(`Backspace: "${currentContent}" -> "${newContent}", cursor ${currentCursor} -> ${newCursorPos}`);
        
        // Schedule parent notification
        setPendingContentChange(newContent);
        
        return {
          content: newContent,
          cursorPosition: newCursorPos
        };
      } else if (direction === 'forward' && currentCursor < currentContent.length) {
        // Forward delete
        const before = currentContent.slice(0, currentCursor);
        const after = currentContent.slice(currentCursor + 1);
        const newContent = before + after;

        logInput(`Forward delete: "${currentContent}" -> "${newContent}", cursor stays at ${currentCursor}`);
        
        // Schedule parent notification
        setPendingContentChange(newContent);
        
        return {
          content: newContent,
          cursorPosition: currentCursor // Stay at same position
        };
      } else {
        logInput(`Delete ignored: direction=${direction}, cursor=${currentCursor}, length=${currentContent.length}`);
        return currentState; // No change
      }
    });
  }, []);

  // Move cursor
  const moveCursor = useCallback((newPos) => {
    setInputState(currentState => {
      const clampedPos = Math.max(0, Math.min(currentState.content.length, newPos));
      logInput(`Move cursor: ${currentState.cursorPosition} -> ${newPos} (clamped to ${clampedPos})`);
      
      return {
        ...currentState,
        cursorPosition: clampedPos
      };
    });
  }, []);

  // Clear input
  const clearInput = useCallback(() => {
    logInput(`Clear input`);
    setInputState({
      content: '',
      cursorPosition: 0
    });
    setPendingContentChange('');
  }, []);

  // Submit handler
  const handleSubmit = useCallback(() => {
    const trimmed = inputState.content.trim();
    logInput(`Submit attempt: content="${inputState.content}", trimmed="${trimmed}"`);
    if (trimmed) {
      onSubmit(trimmed);
      clearInput();
    }
  }, [inputState.content, onSubmit, clearInput]);

  // Key input handler
  useInput((input, key) => {
    logInput(`Key input: input="${input}", key=${JSON.stringify(key)}, mode=${mode}, current cursor=${inputState.cursorPosition}`);

    // Always handle Escape
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

    // Navigation - using functional updates for consistency
    if (key.upArrow) {
      logInput('Navigation: up arrow');
      setInputState(currentState => {
        const { content: currentContent, cursorPosition: currentCursor } = currentState;
        const { col: currentCol } = getCursorLocation(currentCursor, currentContent);
        
        const currentLineStart = currentContent.lastIndexOf('\n', currentCursor - 1);
        const prevLineStart = currentLineStart > 0 ?
          currentContent.lastIndexOf('\n', currentLineStart - 1) : -1;

        if (prevLineStart !== -1) {
          const targetCol = currentCol;
          const prevLineEnd = currentLineStart;
          const prevLineLength = prevLineEnd - prevLineStart - 1;
          const newPos = prevLineStart + 1 + Math.min(targetCol, prevLineLength);
          
          return {
            ...currentState,
            cursorPosition: Math.max(0, Math.min(currentContent.length, newPos))
          };
        }
        
        return currentState;
      });
      return;
    }

    if (key.downArrow) {
      logInput('Navigation: down arrow');
      setInputState(currentState => {
        const { content: currentContent, cursorPosition: currentCursor } = currentState;
        const { col: currentCol } = getCursorLocation(currentCursor, currentContent);
        
        const currentLineEnd = currentContent.indexOf('\n', currentCursor);
        const nextLineEnd = currentLineEnd !== -1 ?
          currentContent.indexOf('\n', currentLineEnd + 1) : -1;

        if (currentLineEnd !== -1) {
          const targetCol = currentCol;
          const nextLineStart = currentLineEnd + 1;
          const nextLineLength = nextLineEnd !== -1 ?
            nextLineEnd - nextLineStart :
            currentContent.length - nextLineStart;
          const newPos = nextLineStart + Math.min(targetCol, nextLineLength);
          
          return {
            ...currentState,
            cursorPosition: Math.max(0, Math.min(currentContent.length, newPos))
          };
        }
        
        return currentState;
      });
      return;
    }

    if (key.leftArrow) {
      logInput('Navigation: left arrow');
      moveCursor(inputState.cursorPosition - 1);
      return;
    }

    if (key.rightArrow) {
      logInput('Navigation: right arrow');
      moveCursor(inputState.cursorPosition + 1);
      return;
    }

    // Home/End
    if (key.home) {
      logInput('Navigation: home');
      setInputState(currentState => {
        const lineStart = currentState.content.lastIndexOf('\n', currentState.cursorPosition - 1) + 1;
        return {
          ...currentState,
          cursorPosition: lineStart
        };
      });
      return;
    }

    if (key.end) {
      logInput('Navigation: end');
      setInputState(currentState => {
        const lineEnd = currentState.content.indexOf('\n', currentState.cursorPosition);
        return {
          ...currentState,
          cursorPosition: lineEnd === -1 ? currentState.content.length : lineEnd
        };
      });
      return;
    }

    // Delete operations
    if (key.backspace) {
      logInput('Delete: backspace key detected');
      deleteChar('backward');
      return;
    }

    if (key.delete) {
      logInput('Delete: delete key detected');
      deleteChar('backward'); // Most terminals treat this as backspace
      return;
    }

    // Forward delete
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

  // Debug: Log current state for rendering
  logInput(`Rendering with: content="${inputState.content}", cursor=${inputState.cursorPosition}, row=${cursorRow}, col=${cursorCol}`);

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
        {!isEmpty && ` • ${inputState.content.length} chars`}
      </Text>
    </Box>
  );
}

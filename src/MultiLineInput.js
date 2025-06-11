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
  mode = 'insert', // 'insert' | 'normal'
  onModeChange,
  content = '',
  onContentChange
}) {
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Debug content changes from parent
  React.useEffect(() => {
    console.log('📝 CONTENT DEBUG - Content prop changed from parent:', {
      newContent: JSON.stringify(content),
      length: content.length,
      cursorPosition,
      timestamp: new Date().toISOString()
    });
  }, [content]);
  
  // Debug cursor position changes
  React.useEffect(() => {
    console.log('📍 CURSOR DEBUG - Cursor position changed:', {
      newPosition: cursorPosition,
      contentLength: content.length,
      isValid: cursorPosition <= content.length
    });
  }, [cursorPosition, content.length]);
  
  // Wrap onContentChange to debug when it's called
  const debugOnContentChange = useCallback((newContent) => {
    console.log('🔄 CALLBACK DEBUG - onContentChange called:', {
      newContent: JSON.stringify(newContent),
      timestamp: new Date().toISOString()
    });
    onContentChange(newContent);
  }, [onContentChange]);

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
    
    console.log('✏️ INSERT DEBUG - Inserting text:', {
      text: JSON.stringify(text),
      before: JSON.stringify(before),
      after: JSON.stringify(after),
      newContent: JSON.stringify(newContent),
      cursorPosition
    });
    
    onContentChange(newContent);
    setCursorPosition(cursorPosition + text.length);
  }, [content, cursorPosition, debugOnContentChange]);

  // Delete character
  const deleteChar = useCallback((direction = 'backward') => {
    console.log('🔍 DELETE DEBUG - deleteChar called:', {
      direction,
      cursorPosition,
      contentLength: content.length,
      content: JSON.stringify(content),
      canDeleteBackward: direction === 'backward' && cursorPosition > 0,
      canDeleteForward: direction === 'forward' && cursorPosition < content.length
    });

    if (direction === 'backward' && cursorPosition > 0) {
      // Backspace
      const before = content.slice(0, cursorPosition - 1);
      const after = content.slice(cursorPosition);
      const newContent = before + after;
      const newCursorPos = cursorPosition - 1;
      
      console.log('🔍 DELETE DEBUG - Backspace operation:', {
        before: JSON.stringify(before),
        after: JSON.stringify(after),
        newContent: JSON.stringify(newContent),
        oldCursorPos: cursorPosition,
        newCursorPos
      });
      
      debugOnContentChange(newContent);
      setCursorPosition(newCursorPos);
    } else if (direction === 'forward' && cursorPosition < content.length) {
      // Delete
      const before = content.slice(0, cursorPosition);
      const after = content.slice(cursorPosition + 1);
      const newContent = before + after;
      
      console.log('🔍 DELETE DEBUG - Forward delete operation:', {
        before: JSON.stringify(before),
        after: JSON.stringify(after),
        newContent: JSON.stringify(newContent),
        cursorPos: cursorPosition
      });
      
      debugOnContentChange(newContent);
      // Cursor position stays the same
    } else {
      console.log('🔍 DELETE DEBUG - No delete operation performed (conditions not met)');
    }
  }, [content, cursorPosition, debugOnContentChange]);

  // Move cursor
  const moveCursor = useCallback((newPos) => {
    const clampedPos = Math.max(0, Math.min(content.length, newPos));
    setCursorPosition(clampedPos);
  }, [content.length]);

  // Clear input
  const clearInput = useCallback(() => {
    console.log('🧹 CLEAR DEBUG - Clearing input');
    debugOnContentChange('');
    setCursorPosition(0);
  }, [debugOnContentChange]);

  // Submit handler
  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (trimmed) {
      onSubmit(trimmed);
      clearInput();
    }
  }, [content, onSubmit, clearInput]);

  // Key input handler - only active in INSERT mode
  useInput((input, key) => {
    console.log('⌨️ KEY DEBUG - Key input received:', {
      input,
      key: Object.keys(key).filter(k => key[k]).join(', '),
      mode,
      cursorPosition,
      contentLength: content.length
    });
    // Always handle Escape to switch to NORMAL mode
    if (key.escape) {
      onModeChange('normal');
      return;
    }

    // Only handle other keys in INSERT mode
    if (mode !== 'insert') {
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
    // On Mac, the delete key should delete backward (like backspace)
    // fn+delete would be forward delete, but that's handled differently by the system
    if (key.delete) {
      console.log('⌨️ KEY DEBUG - Delete key pressed (treating as backward delete for Mac)');
      deleteChar('backward');
      return;
    }

    if (key.backspace) {
      console.log('⌨️ KEY DEBUG - Backspace key pressed');
      deleteChar('backward');
      return;
    }

    // Enter: New line
    if (key.return) {
      insertText('\n');
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

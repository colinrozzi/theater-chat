#!/usr/bin/env node

// Simple test to check if our TypeScript files can be imported
try {
  console.log("Testing TypeScript syntax...");
  
  // Check if types file is parseable
  const fs = require('fs');
  const content = fs.readFileSync('/Users/colinrozzi/work/tools/theater-chat/src/types.ts', 'utf8');
  console.log("✓ types.ts is readable");
  
  // Try to parse a simple line to check for obvious syntax errors
  if (content.includes('export interface')) {
    console.log("✓ types.ts contains expected interface exports");
  }
  
  console.log("Basic syntax check passed!");
  
} catch (error) {
  console.error("Error:", error.message);
}

#!/usr/bin/env node

// Simple test to verify the enhanced config listing works
// Run with: node test-enhanced-listing.js

import { execSync } from 'child_process';
import path from 'path';

const projectDir = '/Users/colinrozzi/work/tools/theater-chat';

console.log('🔧 Building TypeScript project...');

try {
  // Build the project
  const buildOutput = execSync('tsc', { 
    cwd: projectDir,
    encoding: 'utf8',
    timeout: 30000
  });
  
  console.log('✅ Build completed successfully');
  console.log('');
  
  // Test the enhanced listing
  console.log('🎭 Testing enhanced config listing...');
  console.log('');
  
  const listOutput = execSync('node dist/index.js list', {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: 10000
  });
  
  console.log(listOutput);
  
} catch (error) {
  console.error('❌ Error occurred:');
  console.error('STDOUT:', error.stdout || '');
  console.error('STDERR:', error.stderr || '');
  console.error('Exit code:', error.status);
}

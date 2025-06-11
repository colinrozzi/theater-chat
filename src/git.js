import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cwd } from 'node:process';

/**
 * Find the git repository root by walking up the directory tree
 */
export function findGitRepository() {
  let dir = cwd();
  
  while (dir !== '/') {
    if (existsSync(join(dir, '.git'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  
  throw new Error('Not in a git repository');
}

/**
 * Get current git context (branch, status, etc.)
 */
export function getGitContext(repoPath) {
  try {
    const options = { cwd: repoPath, encoding: 'utf8' };
    
    // Get current branch
    let branch;
    try {
      branch = execSync('git branch --show-current', options).toString().trim();
    } catch {
      branch = 'HEAD (detached)';
    }
    
    // Get repository status
    let status;
    try {
      const statusOutput = execSync('git status --porcelain', options).toString().trim();
      status = statusOutput || 'Working tree clean';
    } catch {
      status = 'Unable to determine status';
    }
    
    // Get last commit info
    let lastCommit;
    try {
      lastCommit = execSync('git log -1 --oneline', options).toString().trim();
    } catch {
      lastCommit = 'No commits yet';
    }
    
    return {
      repository: repoPath,
      branch,
      status,
      lastCommit
    };
  } catch (error) {
    throw new Error(`Failed to get git context: ${error.message}`);
  }
}

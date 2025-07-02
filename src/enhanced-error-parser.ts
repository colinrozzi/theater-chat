/**
 * Enhanced error parser with Theater connection-specific error handling
 */

import { formatActorError } from './error-parser.js';

/**
 * Checks if an error is related to Theater server connection issues
 */
function isTheaterConnectionError(error: any): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for various connection-related error patterns
  return (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('TCP connection failed') ||
    errorMessage.includes('connect ECONNREFUSED') ||
    errorMessage.includes('Connection refused') ||
    errorMessage.includes('Failed to connect to') ||
    (errorMessage.includes('127.0.0.1:9000') && errorMessage.includes('connect'))
  );
}

/**
 * Creates a user-friendly error message for Theater connection failures
 */
function formatTheaterConnectionError(serverAddress: string): string {
  return `Theater Server not listening on ${serverAddress}

If you have theater-server installed, run:
  theater-server --log-stdout

If you do not have it installed, install it with:
  cargo install theater-server-cli theater-cli

For more information, visit: https://github.com/colinrozzi/theater`;
}

/**
 * Enhanced error formatter that provides better messages for connection issues
 */
export function formatTheaterError(error: any, serverAddress: string = '127.0.0.1:9000'): string {
  // Check if this is a Theater connection error
  if (isTheaterConnectionError(error)) {
    return formatTheaterConnectionError(serverAddress);
  }
  
  // Fall back to the existing error parser for other errors
  return formatActorError(error);
}

/**
 * Checks if this is a connection error that should cause the program to exit
 */
export function shouldExitOnError(error: any): boolean {
  return isTheaterConnectionError(error);
}

/**
 * Utility function to extract server address from options
 */
export function getServerAddress(options: { server?: string }): string {
  return options.server || '127.0.0.1:9000';
}

// src/logger.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LoggerConfig {
  verbose: boolean;
  fileLogging: boolean;
  level: LogLevel;
  component?: string;
}

class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logFile?: string;
  private initialized = false;

  private constructor() {
    // Default configuration - will be overridden by initialize()
    this.config = {
      verbose: false,
      fileLogging: false,
      level: 'INFO'
    };
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public initialize(config: LoggerConfig): void {
    this.config = config;
    this.initialized = true;

    if (this.config.fileLogging) {
      this.setupFileLogging();
    }
  }

  private setupFileLogging(): void {
    const logDirectory = this.getLogDirectory();
    this.logFile = path.join(logDirectory, 'theater-chat.log');
    
    try {
      fs.mkdirSync(logDirectory, { recursive: true });
      const sessionStart = `=== theater-chat session started at ${new Date().toISOString()} ===\n`;
      fs.writeFileSync(this.logFile, sessionStart);
    } catch (error) {
      // Fallback: disable file logging if we can't set it up
      this.config.fileLogging = false;
      this.warn('Failed to setup file logging, continuing without it');
    }
  }

  private getLogDirectory(): string {
    const platform = os.platform();
    
    if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'theater-chat', 'logs');
    } else {
      const xdgDataHome = process.env.XDG_DATA_HOME;
      if (xdgDataHome) {
        return path.join(xdgDataHome, 'theater-chat', 'logs');
      }
      return path.join(os.homedir(), '.local', 'share', 'theater-chat', 'logs');
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.initialized) return false;
    
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, component?: string): string {
    const timestamp = new Date().toISOString();
    const comp = component || this.config.component || 'APP';
    return `[${timestamp}] [${comp}] ${level}: ${message}`;
  }

  private writeToFile(formattedMessage: string): void {
    if (!this.config.fileLogging || !this.logFile) return;
    
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      // Silently fail file writes to avoid infinite logging loops
    }
  }

  private writeToConsole(level: LogLevel, message: string, component?: string): void {
    if (!this.config.verbose) return;
    
    const comp = component || this.config.component || 'APP';
    const colorizedLevel = this.colorizeLevel(level);
    const colorizedComponent = chalk.gray(`[${comp}]`);
    
    // Use console.error for all levels to avoid mixing with UI output
    console.error(`${colorizedLevel} ${colorizedComponent} ${message}`);
  }

  private colorizeLevel(level: LogLevel): string {
    switch (level) {
      case 'DEBUG': return chalk.magenta(`[${level}]`);
      case 'INFO': return chalk.blue(`[${level}]`);
      case 'WARN': return chalk.yellow(`[${level}]`);
      case 'ERROR': return chalk.red(`[${level}]`);
      default: return `[${level}]`;
    }
  }

  public debug(message: string, component?: string): void {
    if (!this.shouldLog('DEBUG')) return;
    
    const formatted = this.formatMessage('DEBUG', message, component);
    this.writeToFile(formatted);
    this.writeToConsole('DEBUG', message, component);
  }

  public info(message: string, component?: string): void {
    if (!this.shouldLog('INFO')) return;
    
    const formatted = this.formatMessage('INFO', message, component);
    this.writeToFile(formatted);
    this.writeToConsole('INFO', message, component);
  }

  public warn(message: string, component?: string): void {
    if (!this.shouldLog('WARN')) return;
    
    const formatted = this.formatMessage('WARN', message, component);
    this.writeToFile(formatted);
    this.writeToConsole('WARN', message, component);
  }

  public error(message: string, component?: string): void {
    if (!this.shouldLog('ERROR')) return;
    
    const formatted = this.formatMessage('ERROR', message, component);
    this.writeToFile(formatted);
    this.writeToConsole('ERROR', message, component);
  }

  // Convenience method for creating component-specific loggers
  public forComponent(componentName: string): ComponentLogger {
    return new ComponentLogger(this, componentName);
  }

  // Method to update config at runtime
  public updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Re-setup file logging if it was enabled
    if (newConfig.fileLogging && !this.logFile) {
      this.setupFileLogging();
    }
  }

  public getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Component-specific logger that automatically adds component context
class ComponentLogger {
  constructor(private logger: Logger, private component: string) {}

  debug(message: string): void {
    this.logger.debug(message, this.component);
  }

  info(message: string): void {
    this.logger.info(message, this.component);
  }

  warn(message: string): void {
    this.logger.warn(message, this.component);
  }

  error(message: string): void {
    this.logger.error(message, this.component);
  }
}

// Export singleton instance and helper functions
export const logger = Logger.getInstance();

// Helper function to initialize logger from CLI options
export function initializeLogger(options: { verbose?: boolean; log?: boolean; debug?: boolean }): void {
  logger.initialize({
    verbose: options.verbose || false,
    fileLogging: options.log || options.verbose || false,
    level: options.debug ? 'DEBUG' : options.verbose ? 'INFO' : 'WARN'
  });
}

// Export component logger creator
export function createComponentLogger(component: string): ComponentLogger {
  return logger.forComponent(component);
}

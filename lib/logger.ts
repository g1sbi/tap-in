/**
 * Centralized logging utility.
 * Provides structured logging with context and automatic filtering in production.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment: boolean;
  
  constructor() {
    // Check multiple ways to determine if we're in development
    // @ts-ignore - __DEV__ is a global in React Native
    const isDevGlobal = typeof __DEV__ !== 'undefined' && __DEV__;
    const isDevEnv = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
    this.isDevelopment = isDevGlobal || isDevEnv;
  }
  
  private log(level: LogLevel, context: string, message: string, data?: any): void {
    // Always show error and warn logs
    // Only filter debug logs in production
    if (level === 'debug' && !this.isDevelopment) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
    
    // Use console.log for debug, console[level] for others
    const consoleMethod = level === 'debug' ? 'log' : level;
    
    if (data !== undefined) {
      console[consoleMethod](`${prefix} ${message}`, data);
    } else {
      console[consoleMethod](`${prefix} ${message}`);
    }
  }
  
  debug(context: string, message: string, data?: any): void {
    this.log('debug', context, message, data);
  }
  
  info(context: string, message: string, data?: any): void {
    this.log('info', context, message, data);
  }
  
  warn(context: string, message: string, data?: any): void {
    this.log('warn', context, message, data);
  }
  
  error(context: string, message: string, error?: any): void {
    this.log('error', context, message, error);
  }
}

export const logger = new Logger();


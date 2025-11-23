/**
 * Centralized logging utility.
 * Provides structured logging with context and automatic filtering in production.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
  
  private log(level: LogLevel, context: string, message: string, data?: any): void {
    if (!this.isDevelopment && level === 'debug') return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
    
    if (data !== undefined) {
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`, data);
    } else {
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`);
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


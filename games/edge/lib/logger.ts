type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs
  private enabled = __DEV__; // Only log in development

  private log(level: LogLevel, category: string, message: string, data?: unknown) {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data !== undefined ? this.sanitizeData(data) : undefined,
    };

    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with formatting
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${category}]`;
    const consoleMethod =
      level === 'error'
        ? console.error
        : level === 'warn'
        ? console.warn
        : level === 'info'
        ? console.info
        : console.log;

    if (data !== undefined) {
      consoleMethod(`${prefix} ${message}`, data);
    } else {
      consoleMethod(`${prefix} ${message}`);
    }
  }

  private sanitizeData(data: unknown): unknown {
    // Remove sensitive data from logs
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data } as Record<string, unknown>;
      const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];

      for (const key of sensitiveKeys) {
        if (key in sanitized) {
          sanitized[key] = '[REDACTED]';
        }
      }

      return sanitized;
    }

    return data;
  }

  debug(category: string, message: string, data?: unknown) {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: unknown) {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: unknown) {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: unknown) {
    this.log('error', category, message, data);
  }

  // Get all logs (useful for debugging)
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Get logs filtered by category
  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter((log) => log.category === category);
  }

  // Clear all logs
  clear() {
    this.logs = [];
  }

  // Export logs as string (useful for sharing/debugging)
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();


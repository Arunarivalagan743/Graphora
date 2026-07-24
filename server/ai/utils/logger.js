/**
 * Structured Production Telemetry & Audit Logger
 */
export class AiLogger {
  logEvent(level, message, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...metadata
    };
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  info(message, metadata) {
    this.logEvent('info', message, metadata);
  }

  warn(message, metadata) {
    this.logEvent('warn', message, metadata);
  }

  error(message, metadata) {
    this.logEvent('error', message, metadata);
  }
}

export const aiLogger = new AiLogger();

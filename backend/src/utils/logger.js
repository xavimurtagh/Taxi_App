import env from '../config/env.js';

// ---------------------------------------------------------------------------
// Log levels and their numeric priorities
// ---------------------------------------------------------------------------
const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LEVEL_COLORS = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m',  // yellow
  info: '\x1b[36m',  // cyan
  debug: '\x1b[90m', // gray
};
const RESET = '\x1b[0m';

// Determine the minimum log level from environment
const currentLevel = LEVELS[process.env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug')] ?? LEVELS.info;

const SERVICE_NAME = process.env.SERVICE_NAME || 'openride-api';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';

// ---------------------------------------------------------------------------
// Logger class
// ---------------------------------------------------------------------------
class Logger {
  /**
   * @param {object} [defaultMeta] - Default metadata merged into every log entry
   */
  constructor(defaultMeta = {}) {
    this._defaultMeta = defaultMeta;
  }

  /**
   * Create a child logger that inherits parent meta and adds its own.
   * Useful for attaching requestId, userId, etc.
   *
   * @param {object} meta
   * @returns {Logger}
   */
  child(meta) {
    return new Logger({ ...this._defaultMeta, ...meta });
  }

  // -- Level methods --------------------------------------------------------

  error(message, meta = {}) {
    this._log('error', message, meta);
  }

  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  // -- Internal -------------------------------------------------------------

  /**
   * Core logging method.
   * In production: JSON to stdout (one line per entry, ready for log aggregators).
   * In development: pretty-printed, coloured output.
   */
  _log(level, message, meta) {
    if (LEVELS[level] > currentLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      message,
      ...this._defaultMeta,
      ...meta,
    };

    // Attach error stack if an Error object is provided
    if (meta instanceof Error) {
      entry.error = {
        message: meta.message,
        stack: meta.stack,
        name: meta.name,
      };
      // Remove the Error object from the spread
      delete entry.message;
      entry.message = message;
    } else if (meta.error instanceof Error) {
      entry.error = {
        message: meta.error.message,
        stack: meta.error.stack,
        name: meta.error.name,
      };
    }

    if (env.NODE_ENV === 'production') {
      // JSON format — one line per log for structured log ingestion
      const stream = level === 'error' ? process.stderr : process.stdout;
      stream.write(JSON.stringify(entry) + '\n');
    } else {
      // Pretty format for development
      const color = LEVEL_COLORS[level] || '';
      const levelTag = `${color}[${level.toUpperCase()}]${RESET}`;
      const ts = entry.timestamp.replace('T', ' ').replace('Z', '');
      const metaStr = Object.keys({ ...this._defaultMeta, ...meta }).length > 0
        ? ` ${JSON.stringify({ ...this._defaultMeta, ...meta }, null, 0)}`
        : '';
      const stream = level === 'error' ? process.stderr : process.stdout;
      stream.write(`${ts} ${levelTag} ${message}${metaStr}\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton logger instance
// ---------------------------------------------------------------------------
const logger = new Logger();

export { Logger };
export default logger;

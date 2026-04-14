/**
 * Frontend logger utility
 * Wraps console methods for consistent logging across the application.
 * In production, error-level logs are still emitted; debug/info are suppressed.
 */

const isDev = import.meta.env.DEV;

const logger = {
  debug: (...args) => {
    if (isDev) console.debug('[DEBUG]', ...args);
  },
  info: (...args) => {
    if (isDev) console.info('[INFO]', ...args);
  },
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
  log: (...args) => {
    if (isDev) console.log('[LOG]', ...args);
  },
};

export default logger;

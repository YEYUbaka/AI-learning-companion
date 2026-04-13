const formatPrefix = (level) => {
  switch (level) {
    case 'error':
      return '[FAIL]';
    case 'warn':
      return '[WARNING]';
    default:
      return '[INFO]';
  }
};

const write = (level, message, ...args) => {
  const prefix = formatPrefix(level);
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
  console[method](prefix, message, ...args);
};

const logger = {
  info(message, ...args) {
    write('info', message, ...args);
  },
  warn(message, ...args) {
    write('warn', message, ...args);
  },
  error(message, ...args) {
    write('error', message, ...args);
  },
};

export default logger;

import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const colors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[37m',
  reset: '\x1b[0m',
};

const consoleFormat = winston.format.printf(({ level, message, timestamp, module: mod, ...meta }) => {
  const color = colors[level as keyof typeof colors] || colors.reset;
  const moduleTag = mod ? `\x1b[35m[${mod}]\x1b[0m ` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${color}[${timestamp}] [${level.toUpperCase()}]${colors.reset} ${moduleTag}${message}${metaStr}`;
});

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
    new (winston.transports as any).DailyRotateFile({
      filename: path.join(logDir, 'bot-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
    }),
    new (winston.transports as any).DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
    }),
  ],
});

export function createModuleLogger(moduleName: string) {
  return {
    info: (msg: string, meta?: Record<string, unknown>) =>
      logger.info(msg, { module: moduleName, ...meta }),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      logger.warn(msg, { module: moduleName, ...meta }),
    error: (msg: string, meta?: Record<string, unknown>) =>
      logger.error(msg, { module: moduleName, ...meta }),
    debug: (msg: string, meta?: Record<string, unknown>) =>
      logger.debug(msg, { module: moduleName, ...meta }),
  };
}

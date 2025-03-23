import winston from 'winston';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Create logs directory if it doesn't exist
const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define log file paths
const errorLogPath = path.join(logsDir, 'error.log');
const combinedLogPath = path.join(logsDir, 'combined.log');
const httpLogPath = path.join(logsDir, 'http.log');

// Configure log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}${info.stack ? `\n${info.stack}` : ''}`
  )
);

// Create logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'oscarMike-api' },
  transports: [
    // Write logs with level 'error' and higher to error.log
    new winston.transports.File({ filename: errorLogPath, level: 'error' }),
    // Write all logs to combined.log
    new winston.transports.File({ filename: combinedLogPath }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })
  ]
});

// HTTP request logger
const httpLogger = winston.createLogger({
  level: 'http',
  format: logFormat,
  defaultMeta: { service: 'oscarMike-http' },
  transports: [
    new winston.transports.File({ filename: httpLogPath })
  ]
});

// If we're not in production, also log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat
    })
  );
  
  httpLogger.add(
    new winston.transports.Console({
      format: consoleFormat
    })
  );
} 

// Create a child logger that includes request information
export const getRequestLogger = (req: any) => {
  return logger.child({
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id
  });
};

// Exports
export default logger;
export { httpLogger }; 
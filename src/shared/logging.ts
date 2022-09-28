import winston from 'winston';

export const getLoggerFor = (
  metadata: Record<string, string>,
): winston.Logger => {
  const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.uncolorize(),
      winston.format.splat(),
      winston.format.json(),
    ),
    defaultMeta: metadata,
    transports: [
      new winston.transports.File({
        filename: 'debug.log',
        dirname: 'logs',
      }),
    ],
  });

  // Pretty-print to console, as well.
  logger.add(
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );

  return logger;
};

export default getLoggerFor;

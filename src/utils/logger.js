require('winston-daily-rotate-file');

const winston = require('winston');
const expressWinston = require('express-winston');

const ROUTES_TO_BE_IGNORED = ['/metrics', '/'];

const isDevelopSystem = () => {
  if (process.env.NODE_ENV === 'develop' || process.env.NODE_ENV === 'testingTest' || process.env.NODE_ENV === 'testingStage') {
    return true;
  }
  return false;
};

const getLogFormat = () => {
  if (isDevelopSystem()) {
    return winston.format.combine(
      winston.format.splat(),
      winston.format.errors({ stack: true }),
      winston.format.timestamp(),
      winston.format.align(),
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({
        level, message, methodName, fileName, timestamp, stack,
      }) => {
        // eslint-disable-next-line no-param-reassign
        timestamp = new Date(timestamp).toISOString();

        let msg = `    ${message}`;
        if (stack) {
          msg = `        ${stack}`;
        }

        if (fileName && methodName) {
          return `${timestamp} ${level}: ${msg} (Method: ${methodName}() File: ${fileName})`;
        } if (fileName) {
          return `${timestamp} ${level}: ${msg} (Method: ${fileName}() File: ${fileName})`;
        } if (methodName) {
          return `${timestamp} ${level}: ${msg} (Method: ${methodName}() File: unknown)`;
        }
        return `${timestamp} ${level}: ${msg}`;
      }),
    );
  }
  return winston.format.combine(
    winston.format.splat(),
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    winston.format.json(),
  );
};

const logger = winston.createLogger({
  level: 'debug',
  exitOnError: false,
  error: { stack: true },
  transports: [
    new winston.transports.Console(
      {
        handleExceptions: true,
        handleRejections: true,
        format: getLogFormat(),
      },
    ),
  ],
});

const logError = (ex = '', fileName = '', methodName = '') => {
  let exObject = ex;
  if (ex !== '' && ex.isAxiosError) {
    const axiosEx = {
      config: ex.config,
      message: ex.message,
      request: ex.request,
      response: ex.response,
      stack: ex.stack,
    };

    if (axiosEx.response) {
      axiosEx.response = {
        data: axiosEx.response.data,
        status: axiosEx.response.status,
      };
    }

    if (axiosEx.request) {
      axiosEx.request = {
        method: axiosEx.request.method,
        path: axiosEx.request.path,
      };
    }

    if (axiosEx.config) {
      axiosEx.config = {
        url: axiosEx.request.url,
        path: axiosEx.request.path,
        data: axiosEx.request.data,
        method: axiosEx.request.method,
        params: axiosEx.request.params,
      };
    }

    exObject = axiosEx;
  }
  logger.error(exObject.message, { methodName, fileName, stack: exObject.stack });
};

const logDebug = (message = '', fileName = '', methodName = '') => {
  logger.debug(message, { methodName, fileName });
};

const logInfo = (message = '', fileName = '', methodName = '') => {
  logger.info(message, { methodName, fileName });
};

const logWarn = (message = '', fileName = '', methodName = '') => {
  logger.warn(message, { methodName, fileName });
};

const logFatal = (message = '', fileName = '', methodName = '') => {
  logger.emerg(message, { methodName, fileName });
};

const enableHttpLogger = (app) => {
  const expressLogger = expressWinston.logger({
    transports: [
      new winston.transports.Console(
        {
          format: getLogFormat(),
        },
      ),
    ],
    exitOnError: false,
    meta: !isDevelopSystem(),
    msg: '{{req.method}} {{req.url}} (Status: {{res.statusCode}} Time: {{res.responseTime}}ms)',
    expressFormat: false,
    colorize: isDevelopSystem(),
    ignoreRoute(req) {
      return ROUTES_TO_BE_IGNORED.includes(req.originalUrl) || req.originalUrl.indexOf('swagger') >= 1;
    },
    headerBlacklist: [
      'host',
      'connection',
      'accept',
      'user-agent',
      'sec-fetch-site',
      'sec-fetch-site',
      'referer',
      'sec-fetch-mode',
      'sec-fetch-dest',
      'accept-encoding',
      'accept-language',
      'if-none-match',
      'httpVersion',
      'x-forwarded-for',
      'x-real-ip',
      'x-forwarded-proto',
      'authorization',
      '',
    ],
  });

  app.use(expressLogger);
};

module.exports.logError = logError;
module.exports.logInfo = logInfo;
module.exports.logDebug = logDebug;
module.exports.logWarn = logWarn;
module.exports.logFatal = logFatal;
module.exports.enableHttpLogger = enableHttpLogger;

const pino = require("pino");
const environment = require("./env");

const logger = pino({
  level: environment.LOG_LEVEL,
  base: {
    service: "helpdesk-api",
    environment: environment.NODE_ENV
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "authorization",
      "password",
      "token",
      "req.headers.authorization",
      "request.headers.authorization",
      "request.body.password"
    ],
    censor: "[REDACTED]"
  }
});

module.exports = logger;

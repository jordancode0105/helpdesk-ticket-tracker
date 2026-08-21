const { randomUUID } = require("crypto");
const logger = require("../config/logger");

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

function resolveRequestId(incomingRequestId) {
  if (
    typeof incomingRequestId === "string" &&
    REQUEST_ID_PATTERN.test(incomingRequestId)
  ) {
    return incomingRequestId;
  }

  return randomUUID();
}

function requestContext(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestId = resolveRequestId(req.get("x-request-id"));

  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);

  res.once("finish", () => {
    const durationNanoseconds = process.hrtime.bigint() - startedAt;
    const durationMs = Number(durationNanoseconds) / 1_000_000;

    logger.info(
      {
        event: "http_request",
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2))
      },
      "Request completed"
    );
  });

  next();
}

module.exports = {
  REQUEST_ID_PATTERN,
  requestContext,
  resolveRequestId
};

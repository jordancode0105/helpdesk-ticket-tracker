const { rateLimit } = require("express-rate-limit");

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      message: "Too many authentication attempts. Please try again later.",
      code: "AUTH_RATE_LIMITED"
    });
  }
});

module.exports = { authRateLimiter };

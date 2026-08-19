const jwt = require("jsonwebtoken");
const environment = require("../config/env");

function generateToken(userId) {
  return jwt.sign({ userId }, environment.JWT_SECRET, {
    algorithm: "HS256",
    audience: environment.JWT_AUDIENCE,
    expiresIn: "7d",
    issuer: environment.JWT_ISSUER
  });
}

module.exports = generateToken;

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const environment = require("../config/env");

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, environment.JWT_SECRET, {
      algorithms: ["HS256"],
      audience: environment.JWT_AUDIENCE,
      issuer: environment.JWT_ISSUER
    });

    req.user = await User.findById(decoded.userId).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized, token failed" });
  }
}

module.exports = { protect };

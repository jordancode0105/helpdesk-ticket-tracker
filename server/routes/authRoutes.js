const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const { authRateLimiter } = require("../middleware/rateLimiters");
const validateRequest = require("../middleware/validateRequest");
const { emptyRequestSchema, loginSchema, signupSchema } = require("../validation/requestSchemas");
const generateToken = require("../utils/generateToken");

const router = express.Router();

function formatUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

router.post("/signup", authRateLimiter, validateRequest(signupSchema), async (req, res) => {
  try {
    const { email, name, password, role } = req.validated.body;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role
    });

    res.status(201).json({
      user: formatUser(user),
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(400).json({ message: "Unable to create user" });
  }
});

router.post("/login", authRateLimiter, validateRequest(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.validated.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      user: formatUser(user),
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(400).json({ message: "Unable to log in" });
  }
});

router.get("/technicians", protect, validateRequest(emptyRequestSchema), async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admins can view technicians" });
  }

  try {
    const technicians = await User.find({ role: "technician" }).select("name email role");

    res.json({ users: technicians.map(formatUser) });
  } catch (error) {
    res.status(500).json({ message: "Unable to get technicians" });
  }
});

router.get("/me", protect, validateRequest(emptyRequestSchema), (req, res) => {
  res.json({ user: formatUser(req.user) });
});

module.exports = router;

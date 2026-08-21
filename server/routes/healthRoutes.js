const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.get("/live", (req, res) => {
  res.json({ status: "ok" });
});

router.get("/ready", async (req, res) => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return res.status(503).json({
      status: "not_ready",
      checks: { mongodb: "down" }
    });
  }

  try {
    await mongoose.connection.db.command({ ping: 1 }, { maxTimeMS: 1000 });

    return res.json({
      status: "ready",
      checks: { mongodb: "up" }
    });
  } catch (error) {
    return res.status(503).json({
      status: "not_ready",
      checks: { mongodb: "down" }
    });
  }
});

module.exports = router;

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const environment = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require("./routes/ticketRoutes");

const app = express();

if (environment.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

function normalizeOrigin(origin) {
  return origin.trim().replace(/\/$/, "");
}

const localOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const deployedOrigins = [environment.CLIENT_URL, environment.CLIENT_URLS, environment.CORS_ORIGIN]
  .filter(Boolean)
  .flatMap((originList) => originList.split(","))
  .map(normalizeOrigin)
  .filter(Boolean);
const allowedOrigins = [...new Set([...localOrigins, ...deployedOrigins])];

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    }
  })
);
app.use(express.json({ limit: "32kb", strict: true }));

app.get("/", (req, res) => {
  res.json({ message: "IT Help Desk Ticket Tracker API is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found", code: "NOT_FOUND" });
});

app.use((error, req, res, next) => {
  if (error.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large",
      code: "PAYLOAD_TOO_LARGE"
    });
  }

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      message: "Request body must contain valid JSON",
      code: "INVALID_JSON"
    });
  }

  console.error(`Unhandled request error: ${error.message}`);
  return res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
});

module.exports = app;

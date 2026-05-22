const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require("./routes/ticketRoutes");

dotenv.config();

const app = express();

function normalizeOrigin(origin) {
  return origin.trim().replace(/\/$/, "");
}

const localOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const deployedOrigins = [process.env.CLIENT_URL, process.env.CLIENT_URLS, process.env.CORS_ORIGIN]
  .filter(Boolean)
  .flatMap((originList) => originList.split(","))
  .map(normalizeOrigin)
  .filter(Boolean);
const allowedOrigins = [...new Set([...localOrigins, ...deployedOrigins])];

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
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "IT Help Desk Ticket Tracker API is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();

const mongoose = require("mongoose");
const app = require("./app");
const environment = require("./config/env");
const connectDB = require("./config/db");
const logger = require("./config/logger");

const PORT = environment.PORT;
const SHUTDOWN_TIMEOUT_MS = 10000;

function closeHttpServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });

    server.closeIdleConnections?.();
  });
}

function installShutdownHandlers(server) {
  let shutdownStarted = false;

  async function shutdown(signal) {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    logger.info({ event: "shutdown_started", signal }, "Graceful shutdown started");

    const timeout = setTimeout(() => {
      logger.fatal(
        { event: "shutdown_timeout", timeoutMs: SHUTDOWN_TIMEOUT_MS },
        "Graceful shutdown timed out"
      );
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      await closeHttpServer(server);

      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }

      clearTimeout(timeout);
      logger.info({ event: "shutdown_complete" }, "Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      clearTimeout(timeout);
      logger.error(
        { event: "shutdown_failed", errorType: error.name },
        "Graceful shutdown failed"
      );
      process.exit(1);
    }
  }

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT);

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  logger.info(
    { event: "server_ready", port: PORT },
    "Server is ready to accept requests"
  );
  installShutdownHandlers(server);
};

startServer().catch(async (error) => {
  logger.fatal(
    { event: "startup_failed", errorType: error.name },
    "Server startup failed before accepting requests"
  );

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }

  process.exit(1);
});

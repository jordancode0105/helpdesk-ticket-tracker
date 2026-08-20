const path = require("path");

process.env.NODE_ENV = "test";
process.env.PORT = "5000";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/helpdesk-integration-placeholder";
process.env.JWT_SECRET = "integration-test-secret-that-is-never-used-outside-tests";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.MONGOMS_DOWNLOAD_DIR ||= path.resolve(
  __dirname,
  "../node_modules/.cache/mongodb-memory-server"
);

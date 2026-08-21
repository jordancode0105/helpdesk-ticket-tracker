const mongoose = require("mongoose");
const environment = require("./env");
const logger = require("./logger");

const connectDB = async () => {
  const connection = await mongoose.connect(environment.MONGO_URI, {
    serverSelectionTimeoutMS: 10000
  });

  logger.info({ event: "database_connected" }, "MongoDB connection established");

  return connection;
};

module.exports = connectDB;

const mongoose = require("mongoose");
const environment = require("./env");

const connectDB = async () => {
  const connection = await mongoose.connect(environment.MONGO_URI);

  console.log(`MongoDB connected: ${connection.connection.host}`);
};

module.exports = connectDB;

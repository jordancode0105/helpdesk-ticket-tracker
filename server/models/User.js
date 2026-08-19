const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["requester", "technician", "admin"],
      default: "requester"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);

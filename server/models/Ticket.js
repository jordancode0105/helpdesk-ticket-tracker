const mongoose = require("mongoose");
const { ACTIVITY_TYPE_VALUES } = require("../domain/ticketActivity");
const { STATUSES } = require("../domain/ticketWorkflow");

const priorities = ["Low", "Medium", "High", "Critical"];

const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 2000
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

const activityValueSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: STATUSES
    },
    priority: {
      type: String,
      enum: priorities
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    _id: false
  }
);

const activityMetadataSchema = new mongoose.Schema(
  {
    commentId: {
      type: mongoose.Schema.Types.ObjectId
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  {
    _id: false
  }
);

const activitySchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      immutable: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true
    },
    type: {
      type: String,
      enum: ACTIVITY_TYPE_VALUES,
      required: true,
      immutable: true
    },
    sequence: {
      type: Number,
      min: 1,
      required: true,
      immutable: true
    },
    previousValue: {
      type: activityValueSchema,
      default: undefined,
      immutable: true
    },
    newValue: {
      type: activityValueSchema,
      default: undefined,
      immutable: true
    },
    metadata: {
      type: activityMetadataSchema,
      default: undefined,
      immutable: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  {
    _id: true
  }
);

const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000
    },
    category: {
      type: String,
      enum: ["Hardware", "Software", "Network", "Account Access", "Email", "Other"],
      default: "Other"
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "Open"
    },
    priority: {
      type: String,
      enum: priorities,
      default: "Medium"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    comments: [commentSchema],
    activities: {
      type: [activitySchema],
      default: [],
      select: false
    },
    activitySequence: {
      type: Number,
      default: 0,
      min: 0,
      select: false
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true
  }
);

ticketSchema.index(
  { createdBy: 1, createdAt: -1, _id: -1 },
  { name: "requester_queue_newest" }
);
ticketSchema.index(
  { assignedTo: 1, createdAt: -1, _id: -1 },
  { name: "technician_queue_newest" }
);
ticketSchema.index({ createdAt: -1, _id: -1 }, { name: "admin_queue_newest" });
ticketSchema.index(
  { status: 1, createdAt: -1, _id: -1 },
  { name: "status_queue_newest" }
);
ticketSchema.index(
  { priority: 1, createdAt: -1, _id: -1 },
  { name: "priority_queue_newest" }
);
ticketSchema.index(
  { title: "text", description: "text" },
  {
    name: "ticket_text_search",
    weights: { title: 5, description: 1 }
  }
);

module.exports = mongoose.model("Ticket", ticketSchema);

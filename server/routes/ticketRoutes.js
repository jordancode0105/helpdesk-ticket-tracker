const express = require("express");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const { ACTIVITY_TYPES, appendTicketActivity } = require("../domain/ticketActivity");
const { canTransitionStatus } = require("../domain/ticketWorkflow");
const { protect } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  addCommentSchema,
  assignTicketSchema,
  createTicketSchema,
  ticketIdSchema,
  ticketActivityResponseSchema,
  ticketListSchema,
  updateTicketSchema
} = require("../validation/requestSchemas");

const router = express.Router();

router.use(protect);

function formatUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function formatActivityUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    role: user.role
  };
}

function formatActivityValue(value) {
  if (!value) {
    return null;
  }

  const formattedValue = {};

  if (value.status) {
    formattedValue.status = value.status;
  }

  if (value.priority) {
    formattedValue.priority = value.priority;
  }

  if (value.user !== undefined) {
    formattedValue.user = formatActivityUser(value.user);
  }

  return formattedValue;
}

function formatActivityMetadata(metadata) {
  if (!metadata) {
    return null;
  }

  const formattedMetadata = {};

  if (metadata.commentId) {
    formattedMetadata.commentId = metadata.commentId.toString();
  }

  if (metadata.reason) {
    formattedMetadata.reason = metadata.reason;
  }

  return formattedMetadata;
}

function formatActivity(activity) {
  return {
    id: activity._id.toString(),
    type: activity.type,
    sequence: activity.sequence,
    createdAt: activity.createdAt.toISOString(),
    actor: formatActivityUser(activity.actor),
    previousValue: formatActivityValue(activity.previousValue),
    newValue: formatActivityValue(activity.newValue),
    metadata: formatActivityMetadata(activity.metadata)
  };
}

function formatComment(comment) {
  return {
    id: comment._id.toString(),
    text: comment.text,
    createdAt: comment.createdAt,
    user: formatUser(comment.user)
  };
}

function formatTicket(ticket) {
  return {
    id: ticket._id.toString(),
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    status: ticket.status,
    priority: ticket.priority,
    createdBy: formatUser(ticket.createdBy),
    assignedTo: formatUser(ticket.assignedTo),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    comments: ticket.comments.map(formatComment)
  };
}

function userIdMatches(value, userId) {
  if (!value || !userId) {
    return false;
  }

  const valueId = value._id ? value._id.toString() : value.toString();

  return valueId === userId.toString();
}

function canViewTicket(ticket, user) {
  if (user.role === "admin") {
    return true;
  }

  if (user.role === "requester") {
    return userIdMatches(ticket.createdBy, user._id);
  }

  if (user.role === "technician") {
    return userIdMatches(ticket.assignedTo, user._id);
  }

  return false;
}

function buildTicketQuery(req) {
  const query = {};

  if (req.user.role === "requester") {
    query.createdBy = req.user._id;
  }

  if (req.user.role === "technician") {
    query.assignedTo = req.user._id;
  }

  const { priority } = req.validated.query;

  if (priority && priority !== "All") {
    query.priority = priority;
  }

  return query;
}

function populateTicketQuery(query) {
  return query
    .populate("createdBy", "name email role")
    .populate("assignedTo", "name email role")
    .populate("comments.user", "name email role");
}

function populateActivityQuery(query) {
  return query
    .populate("activities.actor", "name role")
    .populate("activities.previousValue.user", "name role")
    .populate("activities.newValue.user", "name role");
}

function ticketWithActivityById(id) {
  return Ticket.findById(id).select("+activities +activitySequence");
}

router.get("/", validateRequest(ticketListSchema), async (req, res) => {
  try {
    const tickets = await populateTicketQuery(Ticket.find(buildTicketQuery(req))).sort({
      createdAt: -1
    });

    res.json(tickets.map(formatTicket));
  } catch (error) {
    res.status(500).json({ message: "Unable to get tickets" });
  }
});

router.post("/", validateRequest(createTicketSchema), async (req, res) => {
  if (req.user.role === "technician") {
    return res.status(403).json({ message: "Technicians cannot create tickets" });
  }

  try {
    const { title, description, category, priority } = req.validated.body;
    const newTicket = new Ticket({
      title,
      description,
      category: category || "Other",
      priority: priority || "Medium",
      createdBy: req.user._id
    });

    appendTicketActivity(newTicket, {
      actor: req.user._id,
      type: ACTIVITY_TYPES.TICKET_CREATED
    });

    await newTicket.save();

    const savedTicket = await populateTicketQuery(Ticket.findById(newTicket._id));

    res.status(201).json(formatTicket(savedTicket));
  } catch (error) {
    res.status(400).json({ message: "Unable to create ticket" });
  }
});

router.get("/:id/activity", validateRequest(ticketIdSchema), async (req, res) => {
  try {
    const ticket = await populateActivityQuery(
      ticketWithActivityById(req.validated.params.id)
    );

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!canViewTicket(ticket, req.user)) {
      return res.status(403).json({ message: "You cannot view this ticket's activity" });
    }

    const response = {
      ticketId: ticket._id.toString(),
      events: ticket.activities
        .slice()
        .sort((left, right) => left.sequence - right.sequence)
        .map(formatActivity)
    };

    res.json(ticketActivityResponseSchema.parse(response));
  } catch (error) {
    res.status(500).json({ message: "Unable to get ticket activity" });
  }
});

router.get("/:id", validateRequest(ticketIdSchema), async (req, res) => {
  try {
    const ticket = await populateTicketQuery(Ticket.findById(req.validated.params.id));

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!canViewTicket(ticket, req.user)) {
      return res.status(403).json({ message: "You cannot view this ticket" });
    }

    res.json(formatTicket(ticket));
  } catch (error) {
    res.status(500).json({ message: "Unable to get ticket" });
  }
});

router.put("/:id", validateRequest(updateTicketSchema), async (req, res) => {
  try {
    const ticket = await ticketWithActivityById(req.validated.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!canViewTicket(ticket, req.user)) {
      return res.status(403).json({ message: "You cannot update this ticket" });
    }

    if (req.user.role === "requester") {
      return res.status(403).json({ message: "Requesters cannot update workflow fields" });
    }

    const updates = req.validated.body;

    if (req.user.role === "technician") {
      const requestedFields = Object.keys(updates);

      if (requestedFields.length !== 1 || requestedFields[0] !== "status") {
        return res.status(403).json({
          message: "Technicians can only update the status of assigned tickets"
        });
      }

      if (
        !canTransitionStatus({
          from: ticket.status,
          to: updates.status,
          role: req.user.role
        })
      ) {
        return res.status(403).json({
          message: `Technicians cannot transition a ticket from ${ticket.status} to ${updates.status}`
        });
      }

      if (ticket.status !== updates.status) {
        appendTicketActivity(ticket, {
          actor: req.user._id,
          type: ACTIVITY_TYPES.STATUS_CHANGED,
          previousValue: { status: ticket.status },
          newValue: { status: updates.status }
        });
        ticket.status = updates.status;
      }
    }

    if (req.user.role === "admin") {
      if (Object.hasOwn(updates, "assignedTo") && updates.assignedTo) {
        const technicianExists = await User.exists({
          _id: updates.assignedTo,
          role: "technician"
        });

        if (!technicianExists) {
          return res.status(400).json({ message: "Assigned user must be a technician" });
        }
      }

      if (
        Object.hasOwn(updates, "status") &&
        !canTransitionStatus({
          from: ticket.status,
          to: updates.status,
          role: req.user.role
        })
      ) {
        return res.status(403).json({ message: "This status transition is not allowed" });
      }

      if (Object.hasOwn(updates, "status") && ticket.status !== updates.status) {
        appendTicketActivity(ticket, {
          actor: req.user._id,
          type: ACTIVITY_TYPES.STATUS_CHANGED,
          previousValue: { status: ticket.status },
          newValue: { status: updates.status }
        });
        ticket.status = updates.status;
      }

      if (Object.hasOwn(updates, "priority") && ticket.priority !== updates.priority) {
        appendTicketActivity(ticket, {
          actor: req.user._id,
          type: ACTIVITY_TYPES.PRIORITY_CHANGED,
          previousValue: { priority: ticket.priority },
          newValue: { priority: updates.priority }
        });
        ticket.priority = updates.priority;
      }

      if (Object.hasOwn(updates, "assignedTo")) {
        const previousAssignee = ticket.assignedTo ? ticket.assignedTo.toString() : null;
        const nextAssignee = updates.assignedTo || null;

        if (previousAssignee !== nextAssignee) {
          appendTicketActivity(ticket, {
            actor: req.user._id,
            type: nextAssignee
              ? ACTIVITY_TYPES.TECHNICIAN_ASSIGNED
              : ACTIVITY_TYPES.TECHNICIAN_UNASSIGNED,
            previousValue: previousAssignee ? { user: previousAssignee } : undefined,
            newValue: nextAssignee ? { user: nextAssignee } : undefined
          });
          ticket.assignedTo = nextAssignee;
        }
      }
    }

    await ticket.save();
    const updatedTicket = await populateTicketQuery(Ticket.findById(ticket._id));

    res.json(formatTicket(updatedTicket));
  } catch (error) {
    res.status(400).json({ message: "Unable to update ticket" });
  }
});

router.delete("/:id", validateRequest(ticketIdSchema), async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admins can delete tickets" });
  }

  try {
    const ticket = await Ticket.findByIdAndDelete(req.validated.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json({ message: "Ticket deleted" });
  } catch (error) {
    res.status(400).json({ message: "Unable to delete ticket" });
  }
});

router.post("/:id/comments", validateRequest(addCommentSchema), async (req, res) => {
  try {
    const ticket = await ticketWithActivityById(req.validated.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!canViewTicket(ticket, req.user)) {
      return res.status(403).json({ message: "You cannot comment on this ticket" });
    }

    ticket.comments.push({
      text: req.validated.body.text,
      user: req.user._id
    });

    const addedComment = ticket.comments[ticket.comments.length - 1];

    appendTicketActivity(ticket, {
      actor: req.user._id,
      type: ACTIVITY_TYPES.COMMENT_ADDED,
      metadata: { commentId: addedComment._id }
    });

    const updatedTicket = await ticket.save();
    const populatedTicket = await populateTicketQuery(Ticket.findById(updatedTicket._id));
    const newComment = populatedTicket.comments[populatedTicket.comments.length - 1];

    res.status(201).json(formatComment(newComment));
  } catch (error) {
    res.status(400).json({ message: "Unable to add comment" });
  }
});

router.patch("/:id/assign", validateRequest(assignTicketSchema), async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admins can assign tickets" });
  }

  try {
    const { assignedTo } = req.validated.body;
    const ticket = await ticketWithActivityById(req.validated.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (assignedTo) {
      const technician = await User.findOne({
        _id: assignedTo,
        role: "technician"
      });

      if (!technician) {
        return res.status(400).json({ message: "Assigned user must be a technician" });
      }
    }

    const previousAssignee = ticket.assignedTo ? ticket.assignedTo.toString() : null;
    const nextAssignee = assignedTo || null;

    if (previousAssignee !== nextAssignee) {
      appendTicketActivity(ticket, {
        actor: req.user._id,
        type: nextAssignee
          ? ACTIVITY_TYPES.TECHNICIAN_ASSIGNED
          : ACTIVITY_TYPES.TECHNICIAN_UNASSIGNED,
        previousValue: previousAssignee ? { user: previousAssignee } : undefined,
        newValue: nextAssignee ? { user: nextAssignee } : undefined
      });
      ticket.assignedTo = nextAssignee;
    }

    const updatedTicket = await ticket.save();
    const populatedTicket = await populateTicketQuery(Ticket.findById(updatedTicket._id));

    res.json(formatTicket(populatedTicket));
  } catch (error) {
    res.status(400).json({ message: "Unable to assign ticket" });
  }
});

module.exports = router;

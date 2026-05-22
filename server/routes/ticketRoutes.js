const express = require("express");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

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

  if (req.query.priority && req.query.priority !== "All") {
    query.priority = req.query.priority;
  }

  return query;
}

function populateTicketQuery(query) {
  return query
    .populate("createdBy", "name email role")
    .populate("assignedTo", "name email role")
    .populate("comments.user", "name email role");
}

router.get("/", async (req, res) => {
  try {
    const tickets = await populateTicketQuery(Ticket.find(buildTicketQuery(req))).sort({
      createdAt: -1
    });

    res.json(tickets.map(formatTicket));
  } catch (error) {
    res.status(500).json({ message: "Unable to get tickets" });
  }
});

router.post("/", async (req, res) => {
  if (req.user.role === "technician") {
    return res.status(403).json({ message: "Technicians cannot create tickets" });
  }

  try {
    const newTicket = await Ticket.create({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category || "Other",
      status: req.body.status || "Open",
      priority: req.body.priority || "Medium",
      createdBy: req.user._id
    });

    const savedTicket = await populateTicketQuery(Ticket.findById(newTicket._id));

    res.status(201).json(formatTicket(savedTicket));
  } catch (error) {
    res.status(400).json({ message: "Unable to create ticket" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ticket = await populateTicketQuery(Ticket.findById(req.params.id));

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!canViewTicket(ticket, req.user)) {
      return res.status(403).json({ message: "You cannot view this ticket" });
    }

    res.json(formatTicket(ticket));
  } catch (error) {
    res.status(404).json({ message: "Ticket not found" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!canViewTicket(ticket, req.user)) {
      return res.status(403).json({ message: "You cannot update this ticket" });
    }

    if (req.user.role === "requester") {
      return res.status(403).json({ message: "Requesters cannot update workflow fields" });
    }

    if (req.user.role === "technician") {
      ticket.status = req.body.status || ticket.status;
    }

    if (req.user.role === "admin") {
      ticket.status = req.body.status || ticket.status;
      ticket.priority = req.body.priority || ticket.priority;
      ticket.assignedTo = req.body.assignedTo === "" ? null : req.body.assignedTo || ticket.assignedTo;
    }

    await ticket.save();
    const updatedTicket = await populateTicketQuery(Ticket.findById(ticket._id));

    res.json(formatTicket(updatedTicket));
  } catch (error) {
    res.status(400).json({ message: "Unable to update ticket" });
  }
});

router.delete("/:id", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admins can delete tickets" });
  }

  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json({ message: "Ticket deleted" });
  } catch (error) {
    res.status(400).json({ message: "Unable to delete ticket" });
  }
});

router.post("/:id/comments", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!canViewTicket(ticket, req.user)) {
      return res.status(403).json({ message: "You cannot comment on this ticket" });
    }

    ticket.comments.push({
      text: req.body.text,
      user: req.user._id
    });

    const updatedTicket = await ticket.save();
    const populatedTicket = await populateTicketQuery(Ticket.findById(updatedTicket._id));
    const newComment = populatedTicket.comments[populatedTicket.comments.length - 1];

    res.status(201).json(formatComment(newComment));
  } catch (error) {
    res.status(400).json({ message: "Unable to add comment" });
  }
});

router.patch("/:id/assign", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admins can assign tickets" });
  }

  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (req.body.assignedTo) {
      const technician = await User.findOne({
        _id: req.body.assignedTo,
        role: "technician"
      });

      if (!technician) {
        return res.status(400).json({ message: "Assigned user must be a technician" });
      }
    }

    ticket.assignedTo = req.body.assignedTo || null;
    const updatedTicket = await ticket.save();
    const populatedTicket = await populateTicketQuery(Ticket.findById(updatedTicket._id));

    res.json(formatTicket(populatedTicket));
  } catch (error) {
    res.status(400).json({ message: "Unable to assign ticket" });
  }
});

module.exports = router;

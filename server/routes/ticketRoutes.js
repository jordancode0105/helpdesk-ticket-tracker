const express = require("express");
const Ticket = require("../models/Ticket");

const router = express.Router();

function formatComment(comment) {
  return {
    id: comment._id.toString(),
    text: comment.text,
    createdAt: comment.createdAt
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
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    comments: ticket.comments.map(formatComment)
  };
}

router.get("/", async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });

    res.json(tickets.map(formatTicket));
  } catch (error) {
    res.status(500).json({ message: "Unable to get tickets" });
  }
});

router.post("/", async (req, res) => {
  try {
    const newTicket = await Ticket.create({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category || "Other",
      status: req.body.status || "Open",
      priority: req.body.priority || "Medium"
    });

    res.status(201).json(formatTicket(newTicket));
  } catch (error) {
    res.status(400).json({ message: "Unable to create ticket" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
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

    ticket.title = req.body.title || ticket.title;
    ticket.description = req.body.description || ticket.description;
    ticket.category = req.body.category || ticket.category;
    ticket.status = req.body.status || ticket.status;
    ticket.priority = req.body.priority || ticket.priority;

    const updatedTicket = await ticket.save();

    res.json(formatTicket(updatedTicket));
  } catch (error) {
    res.status(400).json({ message: "Unable to update ticket" });
  }
});

router.delete("/:id", async (req, res) => {
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

    ticket.comments.push({
      text: req.body.text
    });

    const updatedTicket = await ticket.save();
    const newComment = updatedTicket.comments[updatedTicket.comments.length - 1];

    res.status(201).json(formatComment(newComment));
  } catch (error) {
    res.status(400).json({ message: "Unable to add comment" });
  }
});

module.exports = router;

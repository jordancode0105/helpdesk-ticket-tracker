const express = require("express");
const mongoose = require("mongoose");
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
  ticketListResponseSchema,
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

function buildTicketMatch(req) {
  const match = {};

  if (req.user.role === "requester") {
    match.createdBy = req.user._id;
  }

  if (req.user.role === "technician") {
    match.assignedTo = req.user._id;
  }

  const { assignedTo, category, priority, search, status } = req.validated.query;

  if (status) {
    match.status = status;
  }

  if (priority) {
    match.priority = priority;
  }

  if (category) {
    match.category = category;
  }

  if (assignedTo) {
    match.assignedTo =
      assignedTo === "unassigned" ? null : new mongoose.Types.ObjectId(assignedTo);
  }

  if (search) {
    if (/^[a-f\d]{24}$/i.test(search)) {
      match._id = new mongoose.Types.ObjectId(search);
    } else {
      match.$text = { $search: search };
    }
  }

  return match;
}

function buildTicketSortStages(sort) {
  if (sort === "priority-high" || sort === "priority-low") {
    const direction = sort === "priority-high" ? -1 : 1;

    return [
      {
        $addFields: {
          _priorityOrder: {
            $indexOfArray: [["Low", "Medium", "High", "Critical"], "$priority"]
          }
        }
      },
      { $sort: { _priorityOrder: direction, createdAt: -1, _id: -1 } }
    ];
  }

  return [];
}

function buildTicketSort(sort) {
  if (sort === "oldest") {
    return { createdAt: 1, _id: 1 };
  }

  return { createdAt: -1, _id: -1 };
}

function formatSummaryUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    role: user.role
  };
}

async function formatTicketSummaries(tickets) {
  const userIds = [
    ...new Set(
      tickets
        .flatMap((ticket) => [ticket.createdBy, ticket.assignedTo])
        .filter(Boolean)
        .map((userId) => userId.toString())
    )
  ];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("name role").lean()
    : [];
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  return tickets.map((ticket) => {
    const descriptionCharacters = [...ticket.description];

    return {
      id: ticket._id.toString(),
      title: ticket.title,
      descriptionPreview: descriptionCharacters.slice(0, 160).join(""),
      descriptionTruncated: descriptionCharacters.length > 160,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      createdBy: formatSummaryUser(usersById.get(ticket.createdBy.toString())),
      assignedTo: ticket.assignedTo
        ? formatSummaryUser(usersById.get(ticket.assignedTo.toString()))
        : null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString()
    };
  });
}

function formatTicketStats(statusCounts, total) {
  const counts = new Map(statusCounts.map((entry) => [entry._id, entry.count]));

  return {
    total,
    open: counts.get("Open") || 0,
    inProgress: counts.get("In Progress") || 0,
    resolved: counts.get("Resolved") || 0,
    closed: counts.get("Closed") || 0
  };
}

function fetchTicketPage(match, { limit, page, sort }) {
  const skip = (page - 1) * limit;
  const selectedFields = {
    title: 1,
    description: 1,
    category: 1,
    status: 1,
    priority: 1,
    createdBy: 1,
    assignedTo: 1,
    createdAt: 1,
    updatedAt: 1
  };

  if (sort === "priority-high" || sort === "priority-low") {
    return Ticket.aggregate([
      { $match: match },
      ...buildTicketSortStages(sort),
      { $skip: skip },
      { $limit: limit },
      { $project: selectedFields }
    ]).option({ maxTimeMS: 5000 });
  }

  return Ticket.find(match)
    .select(selectedFields)
    .sort(buildTicketSort(sort))
    .skip(skip)
    .limit(limit)
    .maxTimeMS(5000)
    .lean();
}

function populateTicketQuery(query) {
  return query
    .populate("createdBy", "name role")
    .populate("assignedTo", "name role")
    .populate("comments.user", "name role");
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
  if (req.validated.query.assignedTo && req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admins can filter by assigned technician" });
  }

  try {
    const { limit, page, sort } = req.validated.query;
    const match = buildTicketMatch(req);
    const [tickets, totalItems, statusCounts] = await Promise.all([
      fetchTicketPage(match, { limit, page, sort }),
      Ticket.countDocuments(match).maxTimeMS(5000),
      Ticket.aggregate([
        { $match: match },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]).option({ maxTimeMS: 5000 })
    ]);
    const totalPages = Math.ceil(totalItems / limit);
    const response = {
      tickets: await formatTicketSummaries(tickets),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      stats: formatTicketStats(statusCounts, totalItems)
    };

    res.json(ticketListResponseSchema.parse(response));
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

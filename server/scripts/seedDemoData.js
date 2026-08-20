const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const { ACTIVITY_TYPES, appendTicketActivity } = require("../domain/ticketActivity");

dotenv.config();

const demoPassword = "Password123!";

const demoUsers = [
  {
    name: "Demo Requester",
    email: "requester@example.com",
    role: "requester"
  },
  {
    name: "Demo Technician",
    email: "technician@example.com",
    role: "technician"
  },
  {
    name: "Demo Admin",
    email: "admin@example.com",
    role: "admin"
  }
];

async function upsertDemoUser(userData, hashedPassword) {
  return User.findOneAndUpdate(
    { email: userData.email },
    {
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      role: userData.role
    },
    {
      new: true,
      upsert: true
    }
  );
}

async function seedDemoData() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to server/.env before running the seed script.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for demo seed.");

  const hashedPassword = await bcrypt.hash(demoPassword, 10);

  const requester = await upsertDemoUser(demoUsers[0], hashedPassword);
  const technician = await upsertDemoUser(demoUsers[1], hashedPassword);
  const admin = await upsertDemoUser(demoUsers[2], hashedPassword);

  await Ticket.deleteMany({
    createdBy: {
      $in: [requester._id, admin._id]
    }
  });

  const demoTickets = [
    {
      title: "VPN connection fails from home",
      description:
        "User can sign in to email, but the VPN client times out before connecting to internal tools.",
      category: "Network",
      status: "Open",
      priority: "High",
      createdBy: requester._id,
      assignedTo: null,
      comments: [
        {
          text: "Requester confirmed their home internet is working for other sites.",
          user: requester._id
        }
      ]
    },
    {
      title: "Laptop battery drains quickly",
      description:
        "The laptop loses power within an hour even after a full charge and normal browser usage.",
      category: "Hardware",
      status: "In Progress",
      priority: "Medium",
      createdBy: requester._id,
      assignedTo: technician._id,
      comments: [
        {
          text: "Assigned to technician for battery health review.",
          user: admin._id
        },
        {
          text: "Battery report requested from the user.",
          user: technician._id
        }
      ]
    },
    {
      title: "Cannot access shared mailbox",
      description:
        "User gets an access denied message when opening the department shared mailbox in Outlook.",
      category: "Email",
      status: "Resolved",
      priority: "Low",
      createdBy: requester._id,
      assignedTo: technician._id,
      comments: [
        {
          text: "Mailbox permissions were refreshed and access is working again.",
          user: technician._id
        }
      ]
    },
    {
      title: "New hire software setup",
      description:
        "Prepare standard productivity apps and account access for a new employee starting Monday.",
      category: "Software",
      status: "Closed",
      priority: "Medium",
      createdBy: admin._id,
      assignedTo: technician._id,
      comments: [
        {
          text: "Setup completed and verified with the hiring manager.",
          user: technician._id
        }
      ]
    }
  ];

  for (const ticketData of demoTickets) {
    const ticket = new Ticket(ticketData);

    appendTicketActivity(ticket, {
      actor: ticket.createdBy,
      type: ACTIVITY_TYPES.TICKET_CREATED
    });

    if (ticket.priority !== "Medium") {
      appendTicketActivity(ticket, {
        actor: admin._id,
        type: ACTIVITY_TYPES.PRIORITY_CHANGED,
        previousValue: { priority: "Medium" },
        newValue: { priority: ticket.priority }
      });
    }

    if (ticket.assignedTo) {
      appendTicketActivity(ticket, {
        actor: admin._id,
        type: ACTIVITY_TYPES.TECHNICIAN_ASSIGNED,
        newValue: { user: ticket.assignedTo }
      });
    }

    if (ticket.status !== "Open") {
      appendTicketActivity(ticket, {
        actor: ticket.status === "Closed" ? admin._id : ticket.assignedTo || admin._id,
        type: ACTIVITY_TYPES.STATUS_CHANGED,
        previousValue: { status: "Open" },
        newValue: { status: ticket.status }
      });
    }

    for (const comment of ticket.comments) {
      appendTicketActivity(ticket, {
        actor: comment.user,
        type: ACTIVITY_TYPES.COMMENT_ADDED,
        metadata: { commentId: comment._id }
      });
    }

    await ticket.save();
  }

  console.log("Demo users and tickets seeded successfully.");
  console.log("Demo password for all accounts: Password123!");
}

seedDemoData()
  .catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

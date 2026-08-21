import bcrypt from "bcryptjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const User = require("../../models/User");
const Ticket = require("../../models/Ticket");
const generateToken = require("../../utils/generateToken");

export const TEST_PASSWORD = "Password123!";

const testPasswordHash = bcrypt.hashSync(TEST_PASSWORD, 4);
let fixtureSequence = 0;

export function resetFixtureSequence() {
  fixtureSequence = 0;
}

export async function createPersona(role, overrides = {}) {
  fixtureSequence += 1;
  const user = await User.create({
    name: overrides.name || `Test ${role} ${fixtureSequence}`,
    email: overrides.email || `${role}-${fixtureSequence}@example.com`,
    password: testPasswordHash,
    role
  });

  const token = generateToken(user._id);

  return {
    user,
    token,
    authorization: `Bearer ${token}`
  };
}

export async function createTicket({
  createdBy,
  assignedTo = null,
  status = "Open",
  priority = "Medium",
  title,
  description = "A sufficiently detailed integration test ticket description.",
  category = "Software",
  createdAt
}) {
  fixtureSequence += 1;

  const ticketData = {
    title: title || `Integration ticket ${fixtureSequence}`,
    description,
    category,
    status,
    priority,
    createdBy,
    assignedTo
  };

  if (createdAt) {
    ticketData.createdAt = createdAt;
    ticketData.updatedAt = createdAt;
  }

  return Ticket.create(ticketData);
}

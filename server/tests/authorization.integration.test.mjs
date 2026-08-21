import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import {
  TEST_PASSWORD,
  createPersona,
  createTicket,
  resetFixtureSequence
} from "./helpers/fixtures.mjs";

const require = createRequire(import.meta.url);
const environment = require("../config/env");
const Ticket = require("../models/Ticket");
const User = require("../models/User");

let mongoServer;
let app;
let api;

function authorization(persona) {
  return { Authorization: persona.authorization };
}

async function storedTicketWithActivity(ticketId) {
  return Ticket.findById(ticketId).select("+activities +activitySequence");
}

async function createManyTickets(count, buildOptions) {
  const tickets = [];

  for (let index = 0; index < count; index += 1) {
    tickets.push(await createTicket(buildOptions(index)));
  }

  return tickets;
}

function signTestToken(userId, overrides = {}) {
  const secret = overrides.secret || environment.JWT_SECRET;
  const options = {
    algorithm: "HS256",
    audience: overrides.audience || environment.JWT_AUDIENCE,
    expiresIn: overrides.expiresIn ?? "5m",
    issuer: overrides.issuer || environment.JWT_ISSUER
  };

  return jwt.sign({ userId }, secret, options);
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: "helpdesk-integration" }
  });

  const testMongoUri = mongoServer.getUri();

  if (!testMongoUri.startsWith("mongodb://127.0.0.1:")) {
    throw new Error("Integration tests refused a non-local MongoDB URI");
  }

  await mongoose.connect(testMongoUri, { dbName: "helpdesk-integration" });
  await Ticket.syncIndexes();
  app = require("../app");
  api = request(app);
});

beforeEach(async () => {
  await Promise.all([Ticket.deleteMany({}), User.deleteMany({})]);
  resetFixtureSequence();
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("authentication and simulator signup", () => {
  test.each(["requester", "technician", "admin"])(
    "signup preserves the selected %s persona",
    async (role) => {
      const response = await api.post("/api/auth/signup").send({
        name: `Demo ${role}`,
        email: `${role}@example.com`,
        password: TEST_PASSWORD,
        role
      });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe(role);
      expect(response.body.token).toEqual(expect.any(String));

      const storedUser = await User.findOne({ email: `${role}@example.com` });
      expect(storedUser.role).toBe(role);
      expect(storedUser.password).not.toBe(TEST_PASSWORD);
    }
  );

  test("missing signup fields return 400 without creating users", async () => {
    const validSignup = {
      name: "Demo User",
      email: "demo@example.com",
      password: TEST_PASSWORD,
      role: "requester"
    };

    for (const field of Object.keys(validSignup)) {
      const body = { ...validSignup };
      delete body[field];
      const response = await api.post("/api/auth/signup").send(body);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }

    expect(await User.countDocuments()).toBe(0);
  });

  test("invalid signup fields return 400 without creating users", async () => {
    const invalidBodies = [
      { name: "D", email: "demo@example.com", password: TEST_PASSWORD, role: "requester" },
      { name: "Demo", email: "not-an-email", password: TEST_PASSWORD, role: "requester" },
      { name: "Demo", email: "demo@example.com", password: "short", role: "requester" },
      { name: "Demo", email: "demo@example.com", password: TEST_PASSWORD, role: "owner" }
    ];

    for (const body of invalidBodies) {
      const response = await api.post("/api/auth/signup").send(body);
      expect(response.status).toBe(400);
    }

    expect(await User.countDocuments()).toBe(0);
  });

  test("unexpected signup fields return 400", async () => {
    const response = await api.post("/api/auth/signup").send({
      name: "Demo Admin",
      email: "admin@example.com",
      password: TEST_PASSWORD,
      role: "admin",
      organizationOwner: true
    });

    expect(response.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  test("login authenticates a persona and the token identifies the current user", async () => {
    const requester = await createPersona("requester", { email: "login@example.com" });
    const loginResponse = await api.post("/api/auth/login").send({
      email: "LOGIN@example.com",
      password: TEST_PASSWORD
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.id).toBe(requester.user._id.toString());
    expect(loginResponse.body.user.role).toBe("requester");

    const currentUserResponse = await api
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.token}`);
    expect(currentUserResponse.status).toBe(200);
    expect(currentUserResponse.body.user.id).toBe(requester.user._id.toString());
  });

  test.each([
    ["an incorrect password", "login@example.com", "IncorrectPassword123!"],
    ["an unknown email", "unknown@example.com", TEST_PASSWORD]
  ])("login rejects %s", async (label, email, password) => {
    await createPersona("requester", { email: "login@example.com" });
    const response = await api.post("/api/auth/login").send({ email, password });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });

  test("protected endpoints reject unauthenticated requests", async () => {
    const response = await api.get("/api/tickets");
    expect(response.status).toBe(401);
  });

  test("a malformed JWT is rejected", async () => {
    const response = await api.get("/api/tickets").set("Authorization", "Bearer not-a-jwt");
    expect(response.status).toBe(401);
  });

  test.each([
    ["expired", { expiresIn: -1 }],
    ["invalid signature", { secret: "a-different-secret-that-is-at-least-32-characters" }],
    ["wrong audience", { audience: "another-client" }],
    ["wrong issuer", { issuer: "another-api" }]
  ])("a token with %s is rejected", async (label, overrides) => {
    const requester = await createPersona("requester");
    const token = signTestToken(requester.user._id.toString(), overrides);
    const response = await api.get("/api/tickets").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
  });
});

describe("requester authorization", () => {
  test("a requester creates an Open ticket", async () => {
    const requester = await createPersona("requester");
    const response = await api.post("/api/tickets").set(authorization(requester)).send({
      title: "Cannot connect to printer",
      description: "The office printer cannot be reached from this laptop.",
      category: "Hardware",
      priority: "High"
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("Open");
    expect(response.body.createdBy.id).toBe(requester.user._id.toString());

    const storedTicket = await Ticket.findById(response.body.id);
    expect(storedTicket.status).toBe("Open");
  });

  test("caller-supplied creation status is rejected without mutation", async () => {
    const requester = await createPersona("requester");
    const response = await api.post("/api/tickets").set(authorization(requester)).send({
      title: "Cannot connect to printer",
      description: "The office printer cannot be reached from this laptop.",
      status: "Closed"
    });

    expect(response.status).toBe(400);
    expect(await Ticket.countDocuments()).toBe(0);
  });

  test("a requester lists only tickets they created", async () => {
    const requester = await createPersona("requester");
    const otherRequester = await createPersona("requester");
    const ownTicket = await createTicket({ createdBy: requester.user._id });
    await createTicket({ createdBy: otherRequester.user._id });

    const response = await api.get("/api/tickets").set(authorization(requester));

    expect(response.status).toBe(200);
    expect(response.body.tickets.map((ticket) => ticket.id)).toEqual([
      ownTicket._id.toString()
    ]);
  });

  test("a requester retrieves their own ticket but not another requester's", async () => {
    const requester = await createPersona("requester");
    const otherRequester = await createPersona("requester");
    const ownTicket = await createTicket({ createdBy: requester.user._id });
    const otherTicket = await createTicket({ createdBy: otherRequester.user._id });

    const ownResponse = await api
      .get(`/api/tickets/${ownTicket._id}`)
      .set(authorization(requester));
    const otherResponse = await api
      .get(`/api/tickets/${otherTicket._id}`)
      .set(authorization(requester));

    expect(ownResponse.status).toBe(200);
    expect(otherResponse.status).toBe(403);
  });

  test("a requester can comment on their own ticket", async () => {
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .post(`/api/tickets/${ticket._id}/comments`)
      .set(authorization(requester))
      .send({ text: "I restarted the laptop and the issue remains." });

    expect(response.status).toBe(201);
    const storedTicket = await Ticket.findById(ticket._id);
    expect(storedTicket.comments).toHaveLength(1);
  });

  test("a requester cannot comment on another requester's ticket", async () => {
    const requester = await createPersona("requester");
    const otherRequester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: otherRequester.user._id });
    const response = await api
      .post(`/api/tickets/${ticket._id}/comments`)
      .set(authorization(requester))
      .send({ text: "Unauthorized comment attempt." });

    expect(response.status).toBe(403);
    const storedTicket = await Ticket.findById(ticket._id);
    expect(storedTicket.comments).toHaveLength(0);
  });

  test("a requester cannot update another requester's ticket", async () => {
    const requester = await createPersona("requester");
    const otherRequester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: otherRequester.user._id });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(requester))
      .send({ status: "Closed" });

    expect(response.status).toBe(403);
    expect((await Ticket.findById(ticket._id)).status).toBe("Open");
  });

  test.each([
    ["status", { status: "Closed" }],
    ["priority", { priority: "Critical" }],
    ["assignment", { assignedTo: "507f1f77bcf86cd799439011" }]
  ])("a requester cannot modify %s on their own ticket", async (label, update) => {
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(requester))
      .send(update);

    expect(response.status).toBe(403);
    const storedTicket = await Ticket.findById(ticket._id);
    expect(storedTicket.status).toBe("Open");
    expect(storedTicket.priority).toBe("Medium");
    expect(storedTicket.assignedTo).toBeNull();
  });

  test("a requester cannot use the assignment endpoint", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .patch(`/api/tickets/${ticket._id}/assign`)
      .set(authorization(requester))
      .send({ assignedTo: technician.user._id.toString() });

    expect(response.status).toBe(403);
    expect((await Ticket.findById(ticket._id)).assignedTo).toBeNull();
  });

  test("a requester cannot delete tickets", async () => {
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api.delete(`/api/tickets/${ticket._id}`).set(authorization(requester));

    expect(response.status).toBe(403);
    expect(await Ticket.exists({ _id: ticket._id })).toBeTruthy();
  });
});

describe("technician authorization", () => {
  test("a technician cannot create tickets", async () => {
    const technician = await createPersona("technician");
    const response = await api.post("/api/tickets").set(authorization(technician)).send({
      title: "Technician-created ticket",
      description: "This otherwise valid ticket must be rejected."
    });

    expect(response.status).toBe(403);
    expect(await Ticket.countDocuments()).toBe(0);
  });

  test("a technician lists only tickets assigned to them", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const otherTechnician = await createPersona("technician");
    const assignedTicket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id
    });
    await createTicket({ createdBy: requester.user._id });
    await createTicket({
      createdBy: requester.user._id,
      assignedTo: otherTechnician.user._id
    });

    const response = await api.get("/api/tickets").set(authorization(technician));

    expect(response.status).toBe(200);
    expect(response.body.tickets.map((ticket) => ticket.id)).toEqual([
      assignedTicket._id.toString()
    ]);
  });

  test("a technician retrieves only assigned tickets", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const otherTechnician = await createPersona("technician");
    const assigned = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id
    });
    const unassigned = await createTicket({ createdBy: requester.user._id });
    const assignedElsewhere = await createTicket({
      createdBy: requester.user._id,
      assignedTo: otherTechnician.user._id
    });

    expect(
      (await api.get(`/api/tickets/${assigned._id}`).set(authorization(technician))).status
    ).toBe(200);
    expect(
      (await api.get(`/api/tickets/${unassigned._id}`).set(authorization(technician))).status
    ).toBe(403);
    expect(
      (await api.get(`/api/tickets/${assignedElsewhere._id}`).set(authorization(technician)))
        .status
    ).toBe(403);
  });

  test("a technician can comment on an assigned ticket", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id
    });
    const response = await api
      .post(`/api/tickets/${ticket._id}/comments`)
      .set(authorization(technician))
      .send({ text: "Diagnostics have started." });

    expect(response.status).toBe(201);
    expect((await Ticket.findById(ticket._id)).comments).toHaveLength(1);
  });

  test("a technician can update status on an assigned ticket", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id
    });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(technician))
      .send({ status: "In Progress" });

    expect(response.status).toBe(200);
    expect((await Ticket.findById(ticket._id)).status).toBe("In Progress");
  });

  test("a technician cannot update an unassigned ticket", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(technician))
      .send({ status: "Resolved" });

    expect(response.status).toBe(403);
    expect((await Ticket.findById(ticket._id)).status).toBe("Open");
  });

  test("a technician cannot update a ticket assigned to another technician", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const otherTechnician = await createPersona("technician");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: otherTechnician.user._id
    });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(technician))
      .send({ status: "Resolved" });

    expect(response.status).toBe(403);
    expect((await Ticket.findById(ticket._id)).status).toBe("Open");
  });

  test.each([
    ["priority", { priority: "Critical" }],
    ["assignment", { assignedTo: "507f1f77bcf86cd799439011" }],
    ["mixed fields", { status: "Resolved", priority: "Critical" }]
  ])("a technician cannot update %s", async (label, update) => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id
    });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(technician))
      .send(update);

    expect(response.status).toBe(403);
    const storedTicket = await Ticket.findById(ticket._id);
    expect(storedTicket.status).toBe("Open");
    expect(storedTicket.priority).toBe("Medium");
    expect(storedTicket.assignedTo.toString()).toBe(technician.user._id.toString());
  });

  test("a technician cannot use the admin assignment endpoint", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .patch(`/api/tickets/${ticket._id}/assign`)
      .set(authorization(technician))
      .send({ assignedTo: technician.user._id.toString() });

    expect(response.status).toBe(403);
    expect((await Ticket.findById(ticket._id)).assignedTo).toBeNull();
  });

  test("a technician cannot delete tickets", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id
    });
    const response = await api
      .delete(`/api/tickets/${ticket._id}`)
      .set(authorization(technician));

    expect(response.status).toBe(403);
    expect(await Ticket.exists({ _id: ticket._id })).toBeTruthy();
  });
});

describe("admin authorization", () => {
  test("an admin lists and retrieves all tickets", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const otherRequester = await createPersona("requester");
    const first = await createTicket({ createdBy: requester.user._id });
    const second = await createTicket({ createdBy: otherRequester.user._id });

    const listResponse = await api.get("/api/tickets").set(authorization(admin));
    const detailResponse = await api.get(`/api/tickets/${first._id}`).set(authorization(admin));

    expect(listResponse.status).toBe(200);
    expect(new Set(listResponse.body.tickets.map((ticket) => ticket.id))).toEqual(
      new Set([first._id.toString(), second._id.toString()])
    );
    expect(detailResponse.status).toBe(200);
  });

  test("an admin can comment on any ticket", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .post(`/api/tickets/${ticket._id}/comments`)
      .set(authorization(admin))
      .send({ text: "Admin triage note." });

    expect(response.status).toBe(201);
    expect((await Ticket.findById(ticket._id)).comments).toHaveLength(1);
  });

  test("an admin can update status and priority", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({ status: "Resolved", priority: "Critical" });

    expect(response.status).toBe(200);
    const storedTicket = await Ticket.findById(ticket._id);
    expect(storedTicket.status).toBe("Resolved");
    expect(storedTicket.priority).toBe("Critical");
  });

  test("an admin assigns and unassigns through the workflow update path", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({ createdBy: requester.user._id });

    const assignResponse = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({ assignedTo: technician.user._id.toString() });
    expect(assignResponse.status).toBe(200);
    expect((await Ticket.findById(ticket._id)).assignedTo.toString()).toBe(
      technician.user._id.toString()
    );

    const unassignResponse = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({ assignedTo: "" });
    expect(unassignResponse.status).toBe(200);
    expect((await Ticket.findById(ticket._id)).assignedTo).toBeNull();
  });

  test("an admin assigns and unassigns through the dedicated assignment path", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({ createdBy: requester.user._id });

    const assignResponse = await api
      .patch(`/api/tickets/${ticket._id}/assign`)
      .set(authorization(admin))
      .send({ assignedTo: technician.user._id.toString() });
    expect(assignResponse.status).toBe(200);
    expect((await Ticket.findById(ticket._id)).assignedTo.toString()).toBe(
      technician.user._id.toString()
    );

    const unassignResponse = await api
      .patch(`/api/tickets/${ticket._id}/assign`)
      .set(authorization(admin))
      .send({ assignedTo: null });
    expect(unassignResponse.status).toBe(200);
    expect((await Ticket.findById(ticket._id)).assignedTo).toBeNull();
  });

  test.each(["requester", "admin"])(
    "both assignment paths reject a %s ID without mutation",
    async (invalidRole) => {
      const admin = await createPersona("admin");
      const requester = await createPersona("requester");
      const invalidAssignee = await createPersona(invalidRole);
      const ticket = await createTicket({ createdBy: requester.user._id });

      for (const [method, path] of [
        ["put", `/api/tickets/${ticket._id}`],
        ["patch", `/api/tickets/${ticket._id}/assign`]
      ]) {
        const response = await api[method](path)
          .set(authorization(admin))
          .send({ assignedTo: invalidAssignee.user._id.toString() });
        expect(response.status).toBe(400);
        expect((await Ticket.findById(ticket._id)).assignedTo).toBeNull();
      }
    }
  );

  test("both assignment paths reject a nonexistent ID without mutation", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const nonexistentId = new mongoose.Types.ObjectId().toString();

    for (const [method, path] of [
      ["put", `/api/tickets/${ticket._id}`],
      ["patch", `/api/tickets/${ticket._id}/assign`]
    ]) {
      const response = await api[method](path)
        .set(authorization(admin))
        .send({ assignedTo: nonexistentId });
      expect(response.status).toBe(400);
      expect((await Ticket.findById(ticket._id)).assignedTo).toBeNull();
    }
  });

  test("both assignment paths reject a malformed ID without mutation", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });

    for (const [method, path] of [
      ["put", `/api/tickets/${ticket._id}`],
      ["patch", `/api/tickets/${ticket._id}/assign`]
    ]) {
      const response = await api[method](path)
        .set(authorization(admin))
        .send({ assignedTo: "not-an-object-id" });
      expect(response.status).toBe(400);
      expect((await Ticket.findById(ticket._id)).assignedTo).toBeNull();
    }
  });

  test("combined admin workflow changes persist together", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({
        status: "In Progress",
        priority: "High",
        assignedTo: technician.user._id.toString()
      });

    expect(response.status).toBe(200);
    const storedTicket = await Ticket.findById(ticket._id);
    expect(storedTicket.status).toBe("In Progress");
    expect(storedTicket.priority).toBe("High");
    expect(storedTicket.assignedTo.toString()).toBe(technician.user._id.toString());
  });

  test("an admin can delete a ticket", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api.delete(`/api/tickets/${ticket._id}`).set(authorization(admin));

    expect(response.status).toBe(200);
    expect(await Ticket.findById(ticket._id)).toBeNull();
  });

  test("only an admin can list technicians", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");

    const adminResponse = await api.get("/api/auth/technicians").set(authorization(admin));
    const requesterResponse = await api
      .get("/api/auth/technicians")
      .set(authorization(requester));
    const technicianResponse = await api
      .get("/api/auth/technicians")
      .set(authorization(technician));

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.users.map((user) => user.id)).toEqual([
      technician.user._id.toString()
    ]);
    expect(requesterResponse.status).toBe(403);
    expect(technicianResponse.status).toBe(403);
  });
});

describe("validation and API boundaries", () => {
  test("invalid enum values return 400 without mutation", async () => {
    const requester = await createPersona("requester");
    const response = await api.post("/api/tickets").set(authorization(requester)).send({
      title: "Invalid category ticket",
      description: "This request contains an invalid category value.",
      category: "Security Incident"
    });

    expect(response.status).toBe(400);
    expect(await Ticket.countDocuments()).toBe(0);
  });

  test.each([
    ["status", { status: "Waiting" }],
    ["priority", { priority: "Urgent" }]
  ])("invalid workflow %s enums return 400 without mutation", async (label, update) => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send(update);

    expect(response.status).toBe(400);
    const storedTicket = await Ticket.findById(ticket._id);
    expect(storedTicket.status).toBe("Open");
    expect(storedTicket.priority).toBe("Medium");
  });

  test("invalid ticket ObjectIds return 400", async () => {
    const requester = await createPersona("requester");
    const response = await api.get("/api/tickets/not-an-object-id").set(authorization(requester));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  test("invalid ticket and comment lengths return 400 without mutation", async () => {
    const requester = await createPersona("requester");
    const shortTicketResponse = await api.post("/api/tickets").set(authorization(requester)).send({
      title: "Bad",
      description: "Too short"
    });
    expect(shortTicketResponse.status).toBe(400);
    expect(await Ticket.countDocuments()).toBe(0);

    const ticket = await createTicket({ createdBy: requester.user._id });
    const shortCommentResponse = await api
      .post(`/api/tickets/${ticket._id}/comments`)
      .set(authorization(requester))
      .send({ text: "No" });
    expect(shortCommentResponse.status).toBe(400);
    expect((await Ticket.findById(ticket._id)).comments).toHaveLength(0);
  });

  test("unexpected body fields return 400 without mutation", async () => {
    const requester = await createPersona("requester");
    const response = await api.post("/api/tickets").set(authorization(requester)).send({
      title: "Unexpected field ticket",
      description: "This request attempts to include an unexpected field.",
      createdBy: requester.user._id.toString()
    });

    expect(response.status).toBe(400);
    expect(await Ticket.countDocuments()).toBe(0);
  });

  test("invalid and unexpected query parameters return 400", async () => {
    const admin = await createPersona("admin");

    const invalidValue = await api
      .get("/api/tickets?priority=Urgent")
      .set(authorization(admin));
    const unexpectedName = await api
      .get("/api/tickets?sort=title")
      .set(authorization(admin));

    expect(invalidValue.status).toBe(400);
    expect(unexpectedName.status).toBe(400);
  });

  test("an invalid mixed workflow request does not partially mutate a ticket", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({ status: "Resolved", priority: "Urgent" });

    expect(response.status).toBe(400);
    const storedTicket = await Ticket.findById(ticket._id);
    expect(storedTicket.status).toBe("Open");
    expect(storedTicket.priority).toBe("Medium");
  });

  test("malformed JSON returns 400", async () => {
    const requester = await createPersona("requester");
    const response = await api
      .post("/api/tickets")
      .set(authorization(requester))
      .set("Content-Type", "application/json")
      .send('{"title":"broken"');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_JSON");
    expect(await Ticket.countDocuments()).toBe(0);
  });

  test("oversized JSON returns 413", async () => {
    const requester = await createPersona("requester");
    const response = await api.post("/api/tickets").set(authorization(requester)).send({
      title: "Oversized ticket request",
      description: "x".repeat(40 * 1024)
    });

    expect(response.status).toBe(413);
    expect(response.body.code).toBe("PAYLOAD_TOO_LARGE");
    expect(await Ticket.countDocuments()).toBe(0);
  });
});

describe("ticket activity history and explicit workflow transitions", () => {
  test("ticket creation records a structured creation event with the requester actor", async () => {
    const requester = await createPersona("requester");
    const createResponse = await api.post("/api/tickets").set(authorization(requester)).send({
      title: "Activity history creation test",
      description: "This ticket proves that creation is durably recorded in its activity history.",
      priority: "High"
    });

    expect(createResponse.status).toBe(201);

    const historyResponse = await api
      .get(`/api/tickets/${createResponse.body.id}/activity`)
      .set(authorization(requester));
    const storedTicket = await storedTicketWithActivity(createResponse.body.id);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.ticketId).toBe(createResponse.body.id);
    expect(historyResponse.body.events).toHaveLength(1);
    expect(historyResponse.body.events[0]).toMatchObject({
      type: "ticket_created",
      sequence: 1,
      actor: {
        id: requester.user._id.toString(),
        name: requester.user.name,
        role: "requester"
      },
      previousValue: null,
      newValue: null,
      metadata: null
    });
    expect(historyResponse.body.events[0].actor).not.toHaveProperty("email");
    expect(historyResponse.body.events[0].createdAt).toEqual(expect.any(String));
    expect(storedTicket.activities[0].ticket.toString()).toBe(createResponse.body.id);
  });

  test("ticket activity uses the same view authorization as ticket details", async () => {
    const requester = await createPersona("requester");
    const otherRequester = await createPersona("requester");
    const assignedTechnician = await createPersona("technician");
    const otherTechnician = await createPersona("technician");
    const admin = await createPersona("admin");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: assignedTechnician.user._id
    });

    for (const allowedPersona of [requester, assignedTechnician, admin]) {
      const response = await api
        .get(`/api/tickets/${ticket._id}/activity`)
        .set(authorization(allowedPersona));
      expect(response.status).toBe(200);
    }

    for (const deniedPersona of [otherRequester, otherTechnician]) {
      const response = await api
        .get(`/api/tickets/${ticket._id}/activity`)
        .set(authorization(deniedPersona));
      expect(response.status).toBe(403);
    }
  });

  test("stored activity event fields cannot be rewritten through the model", async () => {
    const requester = await createPersona("requester");
    const otherUser = await createPersona("admin");
    const createResponse = await api.post("/api/tickets").set(authorization(requester)).send({
      title: "Immutable event field test",
      description: "This ticket verifies that existing audit event fields remain immutable."
    });
    const storedTicket = await storedTicketWithActivity(createResponse.body.id);
    const originalEventId = storedTicket.activities[0]._id.toString();

    storedTicket.activities[0].type = "comment_added";
    storedTicket.activities[0].sequence = 99;
    storedTicket.activities[0].actor = otherUser.user._id;
    await storedTicket.save();

    const reloadedTicket = await storedTicketWithActivity(createResponse.body.id);
    expect(reloadedTicket.activities[0]).toMatchObject({
      _id: new mongoose.Types.ObjectId(originalEventId),
      type: "ticket_created",
      sequence: 1,
      actor: requester.user._id
    });
  });

  test("status and priority events preserve actor and old/new values", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const admin = await createPersona("admin");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id
    });

    const technicianResponse = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(technician))
      .send({ status: "In Progress" });
    const adminResponse = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({ priority: "Critical" });
    const historyResponse = await api
      .get(`/api/tickets/${ticket._id}/activity`)
      .set(authorization(admin));

    expect(technicianResponse.status).toBe(200);
    expect(adminResponse.status).toBe(200);
    expect(historyResponse.body.events).toMatchObject([
      {
        type: "status_changed",
        actor: { id: technician.user._id.toString() },
        previousValue: { status: "Open" },
        newValue: { status: "In Progress" }
      },
      {
        type: "priority_changed",
        actor: { id: admin.user._id.toString() },
        previousValue: { priority: "Medium" },
        newValue: { priority: "Critical" }
      }
    ]);
  });

  test("assignment and unassignment events preserve both technician references", async () => {
    const requester = await createPersona("requester");
    const firstTechnician = await createPersona("technician");
    const secondTechnician = await createPersona("technician");
    const admin = await createPersona("admin");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: firstTechnician.user._id
    });

    const reassignResponse = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({ assignedTo: secondTechnician.user._id.toString() });
    const unassignResponse = await api
      .patch(`/api/tickets/${ticket._id}/assign`)
      .set(authorization(admin))
      .send({ assignedTo: null });
    const historyResponse = await api
      .get(`/api/tickets/${ticket._id}/activity`)
      .set(authorization(admin));

    expect(reassignResponse.status).toBe(200);
    expect(unassignResponse.status).toBe(200);
    expect(historyResponse.body.events).toMatchObject([
      {
        type: "technician_assigned",
        actor: { id: admin.user._id.toString() },
        previousValue: { user: { id: firstTechnician.user._id.toString() } },
        newValue: { user: { id: secondTechnician.user._id.toString() } }
      },
      {
        type: "technician_unassigned",
        actor: { id: admin.user._id.toString() },
        previousValue: { user: { id: secondTechnician.user._id.toString() } },
        newValue: null
      }
    ]);
  });

  test("comment creation records the actor and comment reference atomically", async () => {
    const requester = await createPersona("requester");
    const ticket = await createTicket({ createdBy: requester.user._id });
    const commentResponse = await api
      .post(`/api/tickets/${ticket._id}/comments`)
      .set(authorization(requester))
      .send({ text: "This comment should appear in the durable activity history." });
    const historyResponse = await api
      .get(`/api/tickets/${ticket._id}/activity`)
      .set(authorization(requester));

    expect(commentResponse.status).toBe(201);
    expect(historyResponse.body.events).toMatchObject([
      {
        type: "comment_added",
        actor: { id: requester.user._id.toString() },
        metadata: { commentId: commentResponse.body.id }
      }
    ]);

    const storedTicket = await storedTicketWithActivity(ticket._id);
    expect(storedTicket.comments).toHaveLength(1);
    expect(storedTicket.activities).toHaveLength(1);
  });

  test("rejected mutations create no activity events", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const admin = await createPersona("admin");
    const invalidAssignee = await createPersona("requester");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id
    });

    const requesterResponse = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(requester))
      .send({ priority: "High" });
    const technicianResponse = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(technician))
      .send({ status: "Closed" });
    const adminResponse = await api
      .patch(`/api/tickets/${ticket._id}/assign`)
      .set(authorization(admin))
      .send({ assignedTo: invalidAssignee.user._id.toString() });
    const storedTicket = await storedTicketWithActivity(ticket._id);

    expect(requesterResponse.status).toBe(403);
    expect(technicianResponse.status).toBe(403);
    expect(adminResponse.status).toBe(400);
    expect(storedTicket.status).toBe("Open");
    expect(storedTicket.priority).toBe("Medium");
    expect(storedTicket.assignedTo.toString()).toBe(technician.user._id.toString());
    expect(storedTicket.activities).toHaveLength(0);
  });

  test.each([
    ["Open", "In Progress"],
    ["Open", "Resolved"],
    ["In Progress", "Open"],
    ["In Progress", "Resolved"],
    ["Resolved", "In Progress"]
  ])("an assigned technician may transition %s to %s", async (from, to) => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id,
      status: from
    });

    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(technician))
      .send({ status: to });
    const storedTicket = await storedTicketWithActivity(ticket._id);

    expect(response.status).toBe(200);
    expect(storedTicket.status).toBe(to);
    expect(storedTicket.activities).toHaveLength(1);
  });

  test.each([
    ["Open", "Closed"],
    ["In Progress", "Closed"],
    ["Resolved", "Open"],
    ["Resolved", "Closed"],
    ["Closed", "Open"],
    ["Closed", "In Progress"],
    ["Closed", "Resolved"]
  ])("an assigned technician may not transition %s to %s", async (from, to) => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id,
      status: from
    });

    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(technician))
      .send({ status: to });
    const storedTicket = await storedTicketWithActivity(ticket._id);

    expect(response.status).toBe(403);
    expect(storedTicket.status).toBe(from);
    expect(storedTicket.activities).toHaveLength(0);
  });

  test.each([
    ["Open", "Closed"],
    ["Resolved", "Open"],
    ["Closed", "In Progress"]
  ])("an admin may transition %s to %s", async (from, to) => {
    const requester = await createPersona("requester");
    const admin = await createPersona("admin");
    const ticket = await createTicket({ createdBy: requester.user._id, status: from });

    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({ status: to });
    const storedTicket = await storedTicketWithActivity(ticket._id);

    expect(response.status).toBe(200);
    expect(storedTicket.status).toBe(to);
    expect(storedTicket.activities[0]).toMatchObject({
      type: "status_changed",
      previousValue: { status: from },
      newValue: { status: to }
    });
  });

  test("a combined admin update creates one ordered event per changed field", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const admin = await createPersona("admin");
    const ticket = await createTicket({ createdBy: requester.user._id });

    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({
        status: "Closed",
        priority: "Critical",
        assignedTo: technician.user._id.toString()
      });
    const historyResponse = await api
      .get(`/api/tickets/${ticket._id}/activity`)
      .set(authorization(admin));

    expect(response.status).toBe(200);
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(historyResponse.body.events.map((event) => event.type)).toEqual([
      "status_changed",
      "priority_changed",
      "technician_assigned"
    ]);
    expect(
      historyResponse.body.events.every(
        (event) => event.actor.id === admin.user._id.toString()
      )
    ).toBe(true);
  });

  test("submitting unchanged workflow values does not create misleading events", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const admin = await createPersona("admin");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id
    });

    const response = await api
      .put(`/api/tickets/${ticket._id}`)
      .set(authorization(admin))
      .send({
        status: "Open",
        priority: "Medium",
        assignedTo: technician.user._id.toString()
      });
    const storedTicket = await storedTicketWithActivity(ticket._id);

    expect(response.status).toBe(200);
    expect(storedTicket.activities).toHaveLength(0);
  });
});

describe("scalable ticket list queries", () => {
  test("default pagination returns ten tickets and complete metadata", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    await createManyTickets(12, (index) => ({
      createdBy: requester.user._id,
      title: `Default pagination ticket ${index}`
    }));

    const response = await api.get("/api/tickets").set(authorization(admin));

    expect(response.status).toBe(200);
    expect(response.body.tickets).toHaveLength(10);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 12,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false
    });
    expect(response.body.stats).toEqual({
      total: 12,
      open: 12,
      inProgress: 0,
      resolved: 0,
      closed: 0
    });
  });

  test("custom page sizes and page boundaries return the expected slices", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    await createManyTickets(11, (index) => ({
      createdBy: requester.user._id,
      title: `Boundary pagination ticket ${index}`
    }));

    const thirdPage = await api
      .get("/api/tickets?page=3&limit=5")
      .set(authorization(admin));
    const emptyPage = await api
      .get("/api/tickets?page=4&limit=5")
      .set(authorization(admin));

    expect(thirdPage.status).toBe(200);
    expect(thirdPage.body.tickets).toHaveLength(1);
    expect(thirdPage.body.pagination).toMatchObject({
      page: 3,
      limit: 5,
      totalItems: 11,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true
    });
    expect(emptyPage.status).toBe(200);
    expect(emptyPage.body.tickets).toHaveLength(0);
    expect(emptyPage.body.pagination.totalPages).toBe(3);
  });

  test("the maximum page size is accepted and larger values are rejected", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    await createManyTickets(52, (index) => ({
      createdBy: requester.user._id,
      title: `Maximum pagination ticket ${index}`
    }));

    const maximumResponse = await api
      .get("/api/tickets?limit=50")
      .set(authorization(admin));
    const excessiveResponse = await api
      .get("/api/tickets?limit=51")
      .set(authorization(admin));

    expect(maximumResponse.status).toBe(200);
    expect(maximumResponse.body.tickets).toHaveLength(50);
    expect(excessiveResponse.status).toBe(400);
    expect(excessiveResponse.body.code).toBe("VALIDATION_ERROR");
  });

  test.each([
    "page=0",
    "page=-1",
    "page=1.5",
    "page=not-a-number",
    "page=10001",
    "limit=0",
    "limit=1.5"
  ])("invalid pagination parameter %s is rejected", async (query) => {
    const admin = await createPersona("admin");
    const response = await api.get(`/api/tickets?${query}`).set(authorization(admin));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  test("newest and oldest sorts use the ticket id as a deterministic tie-breaker", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const tickets = await createManyTickets(4, (index) => ({
      createdBy: requester.user._id,
      title: `Stable ordering ticket ${index}`
    }));
    const sameTimestamp = new Date("2026-01-01T12:00:00.000Z");
    await Ticket.collection.updateMany({}, { $set: { createdAt: sameTimestamp } });
    const ascendingIds = tickets.map((ticket) => ticket._id.toString()).sort();

    const newest = await api
      .get("/api/tickets?sort=newest")
      .set(authorization(admin));
    const oldest = await api
      .get("/api/tickets?sort=oldest")
      .set(authorization(admin));

    expect(newest.body.tickets.map((ticket) => ticket.id)).toEqual(
      [...ascendingIds].reverse()
    );
    expect(oldest.body.tickets.map((ticket) => ticket.id)).toEqual(ascendingIds);
  });

  test("requester pagination never includes another requester's tickets", async () => {
    const requester = await createPersona("requester");
    const otherRequester = await createPersona("requester");
    await createManyTickets(7, (index) => ({
      createdBy: requester.user._id,
      title: `Requester own paginated ticket ${index}`
    }));
    await createManyTickets(8, (index) => ({
      createdBy: otherRequester.user._id,
      title: `Requester hidden paginated ticket ${index}`
    }));

    const response = await api
      .get("/api/tickets?page=2&limit=5")
      .set(authorization(requester));

    expect(response.body.pagination.totalItems).toBe(7);
    expect(response.body.tickets).toHaveLength(2);
    expect(
      response.body.tickets.every(
        (ticket) => ticket.createdBy.id === requester.user._id.toString()
      )
    ).toBe(true);
  });

  test("technician pagination includes only tickets assigned to that technician", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const otherTechnician = await createPersona("technician");
    await createManyTickets(6, (index) => ({
      createdBy: requester.user._id,
      assignedTo: technician.user._id,
      title: `Technician assigned paginated ticket ${index}`
    }));
    await createManyTickets(4, (index) => ({
      createdBy: requester.user._id,
      assignedTo: otherTechnician.user._id,
      title: `Technician hidden paginated ticket ${index}`
    }));
    await createTicket({ createdBy: requester.user._id, title: "Unassigned hidden ticket" });

    const response = await api
      .get("/api/tickets?page=2&limit=4")
      .set(authorization(technician));

    expect(response.body.pagination.totalItems).toBe(6);
    expect(response.body.tickets).toHaveLength(2);
    expect(
      response.body.tickets.every(
        (ticket) => ticket.assignedTo.id === technician.user._id.toString()
      )
    ).toBe(true);
  });

  test("admin pagination counts tickets across all requesters and assignments", async () => {
    const admin = await createPersona("admin");
    const firstRequester = await createPersona("requester");
    const secondRequester = await createPersona("requester");
    await createManyTickets(4, (index) => ({
      createdBy: firstRequester.user._id,
      title: `First admin-visible ticket ${index}`
    }));
    await createManyTickets(5, (index) => ({
      createdBy: secondRequester.user._id,
      title: `Second admin-visible ticket ${index}`
    }));

    const response = await api
      .get("/api/tickets?page=2&limit=5")
      .set(authorization(admin));

    expect(response.body.pagination.totalItems).toBe(9);
    expect(response.body.tickets).toHaveLength(4);
  });

  test("search matches title and description terms while omitting nonmatches", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const titleMatch = await createTicket({
      createdBy: requester.user._id,
      title: "Quasarprinter connection failure"
    });
    const descriptionMatch = await createTicket({
      createdBy: requester.user._id,
      title: "Remote network investigation",
      description: "The nebularouter diagnostic is failing for this workstation."
    });
    await createTicket({
      createdBy: requester.user._id,
      title: "Ordinary password reset request"
    });

    const titleResponse = await api
      .get("/api/tickets?search=quasarprinter")
      .set(authorization(admin));
    const descriptionResponse = await api
      .get("/api/tickets?search=nebularouter")
      .set(authorization(admin));

    expect(titleResponse.body.tickets.map((ticket) => ticket.id)).toEqual([
      titleMatch._id.toString()
    ]);
    expect(descriptionResponse.body.tickets.map((ticket) => ticket.id)).toEqual([
      descriptionMatch._id.toString()
    ]);
  });

  test("a ticket id can be searched exactly", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const target = await createTicket({ createdBy: requester.user._id });
    await createTicket({ createdBy: requester.user._id });

    const response = await api
      .get(`/api/tickets?search=${target._id}`)
      .set(authorization(admin));

    expect(response.body.tickets.map((ticket) => ticket.id)).toEqual([
      target._id.toString()
    ]);
  });

  test("search remains constrained by requester visibility", async () => {
    const requester = await createPersona("requester");
    const otherRequester = await createPersona("requester");
    const ownTicket = await createTicket({
      createdBy: requester.user._id,
      title: "Orbitalsearch requester ticket"
    });
    await createTicket({
      createdBy: otherRequester.user._id,
      title: "Orbitalsearch hidden ticket"
    });

    const response = await api
      .get("/api/tickets?search=orbitalsearch")
      .set(authorization(requester));

    expect(response.body.pagination.totalItems).toBe(1);
    expect(response.body.tickets[0].id).toBe(ownTicket._id.toString());
  });

  test.each(["a", "x".repeat(81)])(
    "malformed or oversized search input is rejected",
    async (search) => {
      const admin = await createPersona("admin");
      const response = await api
        .get(`/api/tickets?search=${search}`)
        .set(authorization(admin));

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }
  );

  test.each([
    ["status", "Resolved", { status: "Resolved" }],
    ["priority", "Critical", { priority: "Critical" }],
    ["category", "Network", { category: "Network" }]
  ])("the %s filter returns only matching tickets", async (field, value, options) => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const matching = await createTicket({
      createdBy: requester.user._id,
      title: `Matching ${field} filter ticket`,
      ...options
    });
    await createTicket({
      createdBy: requester.user._id,
      title: `Nonmatching ${field} filter ticket`
    });

    const response = await api
      .get(`/api/tickets?${field}=${encodeURIComponent(value)}`)
      .set(authorization(admin));

    expect(response.body.tickets.map((ticket) => ticket.id)).toEqual([
      matching._id.toString()
    ]);
  });

  test("combined filters compose with search and requester authorization", async () => {
    const requester = await createPersona("requester");
    const otherRequester = await createPersona("requester");
    const matching = await createTicket({
      createdBy: requester.user._id,
      title: "Quantumfilter network outage",
      status: "In Progress",
      priority: "High",
      category: "Network"
    });
    await createTicket({
      createdBy: requester.user._id,
      title: "Quantumfilter wrong category",
      status: "In Progress",
      priority: "High",
      category: "Software"
    });
    await createTicket({
      createdBy: otherRequester.user._id,
      title: "Quantumfilter hidden matching ticket",
      status: "In Progress",
      priority: "High",
      category: "Network"
    });

    const response = await api
      .get(
        "/api/tickets?search=quantumfilter&status=In%20Progress&priority=High&category=Network"
      )
      .set(authorization(requester));

    expect(response.body.pagination.totalItems).toBe(1);
    expect(response.body.tickets[0].id).toBe(matching._id.toString());
    expect(response.body.stats.inProgress).toBe(1);
  });

  test("admins can filter by technician or unassigned state", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const assigned = await createTicket({
      createdBy: requester.user._id,
      assignedTo: technician.user._id,
      title: "Assigned filter ticket"
    });
    const unassigned = await createTicket({
      createdBy: requester.user._id,
      title: "Unassigned filter ticket"
    });

    const assignedResponse = await api
      .get(`/api/tickets?assignedTo=${technician.user._id}`)
      .set(authorization(admin));
    const unassignedResponse = await api
      .get("/api/tickets?assignedTo=unassigned")
      .set(authorization(admin));

    expect(assignedResponse.body.tickets.map((ticket) => ticket.id)).toEqual([
      assigned._id.toString()
    ]);
    expect(unassignedResponse.body.tickets.map((ticket) => ticket.id)).toEqual([
      unassigned._id.toString()
    ]);
  });

  test("non-admin personas cannot supply an assigned technician filter", async () => {
    const requester = await createPersona("requester");
    const technician = await createPersona("technician");
    const response = await api
      .get(`/api/tickets?assignedTo=${technician.user._id}`)
      .set(authorization(requester));

    expect(response.status).toBe(403);
  });

  test("priority sorts follow domain order in both directions", async () => {
    const admin = await createPersona("admin");
    const requester = await createPersona("requester");

    for (const priority of ["Low", "Medium", "High", "Critical"]) {
      await createTicket({
        createdBy: requester.user._id,
        priority,
        title: `${priority} priority sorting ticket`
      });
    }

    const highFirst = await api
      .get("/api/tickets?sort=priority-high")
      .set(authorization(admin));
    const lowFirst = await api
      .get("/api/tickets?sort=priority-low")
      .set(authorization(admin));

    expect(highFirst.body.tickets.map((ticket) => ticket.priority)).toEqual([
      "Critical",
      "High",
      "Medium",
      "Low"
    ]);
    expect(lowFirst.body.tickets.map((ticket) => ticket.priority)).toEqual([
      "Low",
      "Medium",
      "High",
      "Critical"
    ]);
  });

  test("unsupported sort values are rejected", async () => {
    const admin = await createPersona("admin");
    const response = await api
      .get("/api/tickets?sort=arbitraryField")
      .set(authorization(admin));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  test("list summaries omit heavy and sensitive detail fields", async () => {
    const requester = await createPersona("requester");
    const ticket = await createTicket({
      createdBy: requester.user._id,
      description: "A long list response description that should appear only as a bounded preview. ".repeat(4)
    });
    await api
      .post(`/api/tickets/${ticket._id}/comments`)
      .set(authorization(requester))
      .send({ text: "This comment must remain detail-only." });

    const listResponse = await api.get("/api/tickets").set(authorization(requester));
    const detailResponse = await api
      .get(`/api/tickets/${ticket._id}`)
      .set(authorization(requester));
    const summary = listResponse.body.tickets[0];

    expect(summary).toHaveProperty("descriptionPreview");
    expect(summary.descriptionTruncated).toBe(true);
    expect(summary).not.toHaveProperty("description");
    expect(summary).not.toHaveProperty("comments");
    expect(summary).not.toHaveProperty("activities");
    expect(summary.createdBy).not.toHaveProperty("email");
    expect(detailResponse.body.description).toContain("bounded preview");
    expect(detailResponse.body.comments).toHaveLength(1);
    expect(detailResponse.body.createdBy).not.toHaveProperty("email");
  });

  test("the Ticket schema declares the intentional query indexes", () => {
    const indexesByName = new Map(
      Ticket.schema.indexes().map(([fields, options]) => [options.name, fields])
    );

    expect(indexesByName.get("requester_queue_newest")).toEqual({
      createdBy: 1,
      createdAt: -1,
      _id: -1
    });
    expect(indexesByName.get("technician_queue_newest")).toEqual({
      assignedTo: 1,
      createdAt: -1,
      _id: -1
    });
    expect(indexesByName.get("admin_queue_newest")).toEqual({
      createdAt: -1,
      _id: -1
    });
    expect(indexesByName.get("status_queue_newest")).toEqual({
      status: 1,
      createdAt: -1,
      _id: -1
    });
    expect(indexesByName.get("priority_queue_newest")).toEqual({
      priority: 1,
      createdAt: -1,
      _id: -1
    });
    expect(indexesByName.get("ticket_text_search")).toEqual({
      title: "text",
      description: "text"
    });
  });
});

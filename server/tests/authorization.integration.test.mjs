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
  app = require("../app");
  api = request(app);
});

beforeEach(async () => {
  await Promise.all([Ticket.deleteMany({}), User.deleteMany({})]);
  resetFixtureSequence();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongoServer.stop();
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
    expect(response.body.map((ticket) => ticket.id)).toEqual([ownTicket._id.toString()]);
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
    expect(response.body.map((ticket) => ticket.id)).toEqual([assignedTicket._id.toString()]);
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
    expect(new Set(listResponse.body.map((ticket) => ticket.id))).toEqual(
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

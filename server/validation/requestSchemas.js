const { z } = require("zod");

const roles = ["requester", "technician", "admin"];
const categories = ["Hardware", "Software", "Network", "Account Access", "Email", "Other"];
const statuses = ["Open", "In Progress", "Resolved", "Closed"];
const priorities = ["Low", "Medium", "High", "Critical"];

const emptyObject = z.object({}).strict();
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId");

function requestSchema({ body = emptyObject, params = emptyObject, query = emptyObject }) {
  return z.object({ body, params, query }).strict();
}

const signupSchema = requestSchema({
  body: z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email().max(254),
      password: z.string().min(8).max(72),
      role: z.enum(roles)
    })
    .strict()
});

const loginSchema = requestSchema({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email().max(254),
      password: z.string().min(1).max(72)
    })
    .strict()
});

const emptyRequestSchema = requestSchema({});

const ticketListSchema = requestSchema({
  query: z
    .object({
      priority: z.enum(["All", ...priorities]).optional()
    })
    .strict()
});

const createTicketSchema = requestSchema({
  body: z
    .object({
      title: z.string().trim().min(5).max(120),
      description: z.string().trim().min(10).max(5000),
      category: z.enum(categories).optional(),
      priority: z.enum(priorities).optional()
    })
    .strict()
});

const ticketIdSchema = requestSchema({
  params: z.object({ id: objectId }).strict()
});

const updateTicketSchema = requestSchema({
  params: z.object({ id: objectId }).strict(),
  body: z
    .object({
      status: z.enum(statuses).optional(),
      priority: z.enum(priorities).optional(),
      assignedTo: z.union([objectId, z.literal(""), z.null()]).optional()
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, "At least one workflow field is required")
});

const addCommentSchema = requestSchema({
  params: z.object({ id: objectId }).strict(),
  body: z
    .object({
      text: z.string().trim().min(3).max(2000)
    })
    .strict()
});

const assignTicketSchema = requestSchema({
  params: z.object({ id: objectId }).strict(),
  body: z
    .object({
      assignedTo: z.union([objectId, z.literal(""), z.null()])
    })
    .strict()
});

module.exports = {
  addCommentSchema,
  assignTicketSchema,
  createTicketSchema,
  emptyRequestSchema,
  loginSchema,
  signupSchema,
  ticketIdSchema,
  ticketListSchema,
  updateTicketSchema
};

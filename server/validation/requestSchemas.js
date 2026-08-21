const { z } = require("zod");

const roles = ["requester", "technician", "admin"];
const categories = ["Hardware", "Software", "Network", "Account Access", "Email", "Other"];
const statuses = ["Open", "In Progress", "Resolved", "Closed"];
const priorities = ["Low", "Medium", "High", "Critical"];
const ticketSorts = ["newest", "oldest", "priority-high", "priority-low"];

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
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(10),
      search: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .transform((value) => value.replace(/\s+/g, " "))
        .optional(),
      status: z
        .enum(["All", ...statuses])
        .optional()
        .transform((value) => (value === "All" ? undefined : value)),
      priority: z
        .enum(["All", ...priorities])
        .optional()
        .transform((value) => (value === "All" ? undefined : value)),
      category: z
        .enum(["All", ...categories])
        .optional()
        .transform((value) => (value === "All" ? undefined : value)),
      assignedTo: z
        .union([objectId, z.literal("unassigned"), z.literal("All")])
        .optional()
        .transform((value) => (value === "All" ? undefined : value)),
      sort: z.enum(ticketSorts).default("newest")
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

const activityUserResponseSchema = z
  .object({
    id: objectId,
    name: z.string().min(1).max(80),
    role: z.enum(roles)
  })
  .strict();

const activityValueResponseSchema = z
  .object({
    status: z.enum(statuses).optional(),
    priority: z.enum(priorities).optional(),
    user: activityUserResponseSchema.nullable().optional()
  })
  .strict();

const activityMetadataResponseSchema = z
  .object({
    commentId: objectId.optional(),
    reason: z.string().max(500).optional()
  })
  .strict();

const ticketActivityResponseSchema = z
  .object({
    ticketId: objectId,
    events: z.array(
      z
        .object({
          id: objectId,
          type: z.enum([
            "ticket_created",
            "status_changed",
            "priority_changed",
            "technician_assigned",
            "technician_unassigned",
            "comment_added"
          ]),
          sequence: z.number().int().positive(),
          createdAt: z.string().datetime(),
          actor: activityUserResponseSchema.nullable(),
          previousValue: activityValueResponseSchema.nullable(),
          newValue: activityValueResponseSchema.nullable(),
          metadata: activityMetadataResponseSchema.nullable()
        })
        .strict()
    )
  })
  .strict();

const ticketSummaryUserResponseSchema = z
  .object({
    id: objectId,
    name: z.string().min(1).max(80),
    role: z.enum(roles)
  })
  .strict();

const ticketListResponseSchema = z
  .object({
    tickets: z.array(
      z
        .object({
          id: objectId,
          title: z.string().min(1).max(120),
          descriptionPreview: z.string().max(320),
          descriptionTruncated: z.boolean(),
          category: z.enum(categories),
          status: z.enum(statuses),
          priority: z.enum(priorities),
          createdBy: ticketSummaryUserResponseSchema.nullable(),
          assignedTo: ticketSummaryUserResponseSchema.nullable(),
          createdAt: z.string().datetime(),
          updatedAt: z.string().datetime()
        })
        .strict()
    ),
    pagination: z
      .object({
        page: z.number().int().positive(),
        limit: z.number().int().min(1).max(50),
        totalItems: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
        hasNextPage: z.boolean(),
        hasPreviousPage: z.boolean()
      })
      .strict(),
    stats: z
      .object({
        total: z.number().int().nonnegative(),
        open: z.number().int().nonnegative(),
        inProgress: z.number().int().nonnegative(),
        resolved: z.number().int().nonnegative(),
        closed: z.number().int().nonnegative()
      })
      .strict()
  })
  .strict();

module.exports = {
  addCommentSchema,
  assignTicketSchema,
  createTicketSchema,
  emptyRequestSchema,
  loginSchema,
  signupSchema,
  ticketIdSchema,
  ticketActivityResponseSchema,
  ticketListResponseSchema,
  ticketListSchema,
  updateTicketSchema
};

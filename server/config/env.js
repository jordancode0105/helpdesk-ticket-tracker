const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

function isMongoConnectionString(value) {
  return value.startsWith("mongodb://") || value.startsWith("mongodb+srv://");
}

function isHttpUrlList(value) {
  if (!value) {
    return true;
  }

  return value.split(",").every((entry) => {
    try {
      const url = new URL(entry.trim());
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      return false;
    }
  });
}

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    MONGO_URI: z
      .string()
      .trim()
      .min(1, "MONGO_URI is required")
      .refine(isMongoConnectionString, "MONGO_URI must use mongodb:// or mongodb+srv://"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    CLIENT_URL: z.string().trim().optional().refine(isHttpUrlList, "CLIENT_URL must be an HTTP URL"),
    CLIENT_URLS: z
      .string()
      .trim()
      .optional()
      .refine(isHttpUrlList, "CLIENT_URLS must contain comma-separated HTTP URLs"),
    CORS_ORIGIN: z
      .string()
      .trim()
      .optional()
      .refine(isHttpUrlList, "CORS_ORIGIN must contain comma-separated HTTP URLs")
  })
  .passthrough()
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === "production" &&
      !environment.CLIENT_URL &&
      !environment.CLIENT_URLS &&
      !environment.CORS_ORIGIN
    ) {
      context.addIssue({
        code: "custom",
        message: "At least one production client origin is required",
        path: ["CLIENT_URL"]
      });
    }
  });

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid server configuration: ${details}`);
}

module.exports = Object.freeze({
  ...parsedEnvironment.data,
  JWT_ISSUER: "helpdesk-simulator-api",
  JWT_AUDIENCE: "helpdesk-simulator-client"
});

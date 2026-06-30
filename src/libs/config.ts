import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configSchema = z
  .object({
    ZENDESK_SUB_DOMAIN: z.string().min(1, "ZENDESK_SUB_DOMAIN is required"),
    ZENDESK_API_KEY: z.string().optional(),
    ZENDESK_OAUTH_TOKEN: z.string().optional(),
  })
  .refine((d) => d.ZENDESK_API_KEY || d.ZENDESK_OAUTH_TOKEN, {
    message: "Either ZENDESK_API_KEY or ZENDESK_OAUTH_TOKEN is required",
  });

export type AppConfig = z.infer<typeof configSchema>;

let cachedConfig: AppConfig | null = null;

export function getConfig(customEnvPath?: string): AppConfig {
  if (cachedConfig) return cachedConfig;

  const projectRoot = path.resolve(__dirname, "../../");
  const envPath = customEnvPath ?? path.join(projectRoot, ".env");

  if (!fs.existsSync(envPath)) {
    throw new Error(`.env file not found at ${envPath}`);
  }

  const fileContents = fs.readFileSync(envPath, "utf8");
  const parsed = dotenv.parse(fileContents);

  const validated = configSchema.parse(parsed);
  cachedConfig = validated;
  return validated;
}

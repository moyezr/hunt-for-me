import { randomBytes } from "node:crypto";

const prefixes = new Set(["job", "con", "app", "ans"]);

export function createId(prefix: string) {
  if (!prefixes.has(prefix)) {
    throw new Error(`Unsupported id prefix: ${prefix}`);
  }

  return `${prefix}_${randomBytes(6).toString("base64url")}`;
}

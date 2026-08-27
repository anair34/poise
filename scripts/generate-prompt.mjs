/**
 * Triggers daily prompt generation against a running dev server.
 *
 * Run with: npm run prompt:today
 * Optionally target one date: npm run prompt:today -- --day 2026-09-01
 *
 * This calls the same HTTP route Vercel Cron calls, rather than importing the
 * generator directly, so what you exercise locally is exactly what runs in
 * production — including the authorization check.
 */
import { readFileSync } from "node:fs";

const BASE = process.env.POISE_BASE_URL ?? "http://localhost:3000";

function readEnvLocal() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const values = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      values[trimmed.slice(0, index).trim()] = trimmed
        .slice(index + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
    return values;
  } catch {
    return {};
  }
}

const env = readEnvLocal();
const secret = process.env.CRON_SECRET ?? env.CRON_SECRET;

if (!secret) {
  console.error(
    "CRON_SECRET is not set. Add it to .env.local, then restart the dev server.\n" +
      "Generate one with: openssl rand -hex 32",
  );
  process.exit(1);
}

const dayFlag = process.argv.indexOf("--day");
const day = dayFlag !== -1 ? process.argv[dayFlag + 1] : undefined;

const url = new URL("/api/cron/daily-prompt", BASE);
if (day) url.searchParams.set("day", day);

console.log(`POST ${url.pathname}${url.search} -> ${BASE}`);

let response;
try {
  response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
} catch (caught) {
  console.error(
    `Could not reach ${BASE}. Is the dev server running?\n  ${caught.message}`,
  );
  process.exit(1);
}

const payload = await response.json().catch(() => null);

if (!response.ok) {
  console.error(`HTTP ${response.status}`, payload ?? "(no body)");
  process.exit(1);
}

for (const entry of payload?.days ?? []) {
  if (entry.error) {
    console.log(`  ${entry.dayKey}  FAILED`);
    continue;
  }
  console.log(
    `  ${entry.dayKey}  ${entry.created ? "created" : "already present"}  [${entry.source}]`,
  );
  console.log(`             ${entry.text}`);
}

console.log("\nDone.");

import { z } from "zod";

// ─── Shared helpers ────────────────────────────────────────────

const uuid = z.string().uuid("Invalid UUID");

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format");

const note = z.string().max(200, "Note must be 200 characters or fewer");

const reaction = z.enum(["liked", "disliked"], "reaction must be 'liked' or 'disliked'");

// ─── /api/checkin ──────────────────────────────────────────────

export const checkinPostSchema = z.object({
  goal_id: uuid,
});

export const checkinPatchSchema = z.object({
  checkin_id: uuid,
  note,
});

export type CheckinPostInput = z.infer<typeof checkinPostSchema>;
export type CheckinPatchInput = z.infer<typeof checkinPatchSchema>;

// ─── /api/ai-feedback ──────────────────────────────────────────

export const aiFeedbackGetSchema = z.object({
  goal_id: uuid,
  date: dateStr,
});

export const aiFeedbackPatchSchema = z.object({
  feedback_log_id: uuid,
  reaction,
});

export type AiFeedbackGetInput = z.infer<typeof aiFeedbackGetSchema>;
export type AiFeedbackPatchInput = z.infer<typeof aiFeedbackPatchSchema>;

// ─── /api/cron ─────────────────────────────────────────────────

export const cronPostSchema = z.object({
  secret: z.string().min(1, "Secret is required"),
});

export type CronPostInput = z.infer<typeof cronPostSchema>;

// ─── /api/checkin/sync ─────────────────────────────────────────

// sync has no request body, but validate userId comes from Supabase auth
// No input schema needed — route is auth-only with no body

// ─── Utility ───────────────────────────────────────────────────

/**
 * Parse and validate request body with zod.
 * Returns `{ ok: true, data }` or `{ ok: false, error, status }`.
 */
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { ok: true; data: T } | { ok: false; error: string; status: number } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { ok: false, error: message, status: 400 };
  }
  return { ok: true, data: result.data };
}

/**
 * Parse and validate URL query/search params with zod.
 */
export function parseQuery<T>(
  schema: z.ZodSchema<T>,
  url: string
): { ok: true; data: T } | { ok: false; error: string; status: number } {
  const { searchParams } = new URL(url);
  const raw: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    raw[k] = v;
  });
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { ok: false, error: message, status: 400 };
  }
  return { ok: true, data: result.data };
}

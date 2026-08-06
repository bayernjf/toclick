import { describe, it, expect } from "vitest";
import {
  checkinPostSchema,
  checkinPatchSchema,
  aiFeedbackGetSchema,
  aiFeedbackPatchSchema,
  cronPostSchema,
  parseBody,
  parseQuery,
} from "@/lib/validations";

describe("checkinPostSchema", () => {
  it("accepts valid goal_id UUID", () => {
    const result = checkinPostSchema.safeParse({
      goal_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing goal_id", () => {
    const result = checkinPostSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID", () => {
    const result = checkinPostSchema.safeParse({ goal_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = checkinPostSchema.safeParse({ goal_id: "" });
    expect(result.success).toBe(false);
  });
});

describe("checkinPatchSchema", () => {
  it("accepts valid checkin_id and note", () => {
    const result = checkinPatchSchema.safeParse({
      checkin_id: "550e8400-e29b-41d4-a716-446655440000",
      note: "今天打卡了，感觉不错",
    });
    expect(result.success).toBe(true);
  });

  it("rejects note longer than 200 chars", () => {
    const longNote = "a".repeat(201);
    const result = checkinPatchSchema.safeParse({
      checkin_id: "550e8400-e29b-41d4-a716-446655440000",
      note: longNote,
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty note", () => {
    const result = checkinPatchSchema.safeParse({
      checkin_id: "550e8400-e29b-41d4-a716-446655440000",
      note: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("aiFeedbackGetSchema", () => {
  it("accepts valid goal_id and date", () => {
    const result = aiFeedbackGetSchema.safeParse({
      goal_id: "550e8400-e29b-41d4-a716-446655440000",
      date: "2026-07-30",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = aiFeedbackGetSchema.safeParse({
      goal_id: "550e8400-e29b-41d4-a716-446655440000",
      date: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("aiFeedbackPatchSchema", () => {
  it("accepts liked reaction", () => {
    const result = aiFeedbackPatchSchema.safeParse({
      feedback_log_id: "550e8400-e29b-41d4-a716-446655440000",
      reaction: "liked",
    });
    expect(result.success).toBe(true);
  });

  it("accepts disliked reaction", () => {
    const result = aiFeedbackPatchSchema.safeParse({
      feedback_log_id: "550e8400-e29b-41d4-a716-446655440000",
      reaction: "disliked",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown reaction", () => {
    const result = aiFeedbackPatchSchema.safeParse({
      feedback_log_id: "550e8400-e29b-41d4-a716-446655440000",
      reaction: "angry",
    });
    expect(result.success).toBe(false);
  });
});

describe("cronPostSchema", () => {
  it("accepts valid secret", () => {
    const result = cronPostSchema.safeParse({ secret: "my-secret-key" });
    expect(result.success).toBe(true);
  });

  it("rejects empty secret", () => {
    const result = cronPostSchema.safeParse({ secret: "" });
    expect(result.success).toBe(false);
  });
});

describe("parseBody", () => {
  it("returns ok with parsed data on success", () => {
    const result = parseBody(checkinPostSchema, {
      goal_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.goal_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("returns error on invalid input", () => {
    const result = parseBody(checkinPostSchema, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBeTruthy();
    }
  });

  it("handles null input", () => {
    const result = parseBody(checkinPostSchema, null);
    expect(result.ok).toBe(false);
  });
});

describe("parseQuery", () => {
  it("parses query params from URL", () => {
    const url = "https://example.com/api/ai-feedback?goal_id=550e8400-e29b-41d4-a716-446655440000&date=2026-07-30";
    const result = parseQuery(aiFeedbackGetSchema, url);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.date).toBe("2026-07-30");
    }
  });

  it("returns error on missing params", () => {
    const url = "https://example.com/api/ai-feedback";
    const result = parseQuery(aiFeedbackGetSchema, url);
    expect(result.ok).toBe(false);
  });
});

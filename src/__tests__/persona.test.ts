import { describe, it, expect } from "vitest";
import {
  containsBannedWord,
  getPersonaSystemPrompt,
  getPersonaFewShot,
  BANNED_WORDS,
  PERSONA_MAP,
  type PersonaId,
} from "@/lib/ai/persona";

describe("containsBannedWord", () => {
  it("detects exact banned word in text", () => {
    // 使用列表中确认存在的词做 test — 如果列表为空则跳过
    if (BANNED_WORDS.length > 0) {
      const testWord = BANNED_WORDS[0];
      expect(containsBannedWord(`这句话包含${testWord}这个词`)).toBe(true);
    }
  });

  it("returns false for clean text", () => {
    expect(containsBannedWord("今天学习了两小时，效率不错")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(containsBannedWord("")).toBe(false);
  });

  it("returns false for normal feedback text", () => {
    expect(containsBannedWord("今天打卡完成啦，继续保持！💪")).toBe(false);
    expect(containsBannedWord("还不错，至少你来了")).toBe(false);
    expect(containsBannedWord("今天早起成功，精神不错")).toBe(false);
  });
});

describe("PERSONA_MAP", () => {
  it("has bro and senpai personas", () => {
    expect(PERSONA_MAP.bro).toBeDefined();
    expect(PERSONA_MAP.senpai).toBeDefined();
  });

  it("bro has required fields", () => {
    expect(PERSONA_MAP.bro.label).toBeTruthy();
    expect(PERSONA_MAP.bro.emoji).toBeTruthy();
    expect(PERSONA_MAP.bro.desc).toBeTruthy();
  });

  it("senpai has required fields", () => {
    expect(PERSONA_MAP.senpai.label).toBeTruthy();
    expect(PERSONA_MAP.senpai.emoji).toBeTruthy();
    expect(PERSONA_MAP.senpai.desc).toBeTruthy();
  });
});

describe("getPersonaSystemPrompt", () => {
  it("returns non-empty string for bro", () => {
    const prompt = getPersonaSystemPrompt("bro");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns non-empty string for senpai", () => {
    const prompt = getPersonaSystemPrompt("senpai");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("bro and senpai have different prompts", () => {
    const bro = getPersonaSystemPrompt("bro");
    const senpai = getPersonaSystemPrompt("senpai");
    expect(bro).not.toBe(senpai);
  });
});

describe("getPersonaFewShot", () => {
  it("returns array for bro", () => {
    const shots = getPersonaFewShot("bro");
    expect(Array.isArray(shots)).toBe(true);
    expect(shots.length).toBeGreaterThan(0);
  });

  it("returns array for senpai", () => {
    const shots = getPersonaFewShot("senpai");
    expect(Array.isArray(shots)).toBe(true);
    expect(shots.length).toBeGreaterThan(0);
  });

  it("all shots have role and content", () => {
    for (const personaId of ["bro", "senpai"] as PersonaId[]) {
      const shots = getPersonaFewShot(personaId);
      for (const shot of shots) {
        expect(shot.role).toBeTruthy();
        expect(typeof shot.content).toBe("string");
      }
    }
  });
});

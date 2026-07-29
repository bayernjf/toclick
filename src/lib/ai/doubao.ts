import { getPersonaSystemPrompt, getPersonaFewShot, containsBannedWord } from "./persona";
import type { PersonaId } from "./persona";
import type { AiUserState } from "../types";
import {
  GOAL_TYPES,
  DIFFICULTIES,
  PROTECTION_MODE_THRESHOLD,
  MINOR_AGE,
} from "../constants";

// 豆包（火山方舟 Ark）Chat Completions 调用封装
// 文档：https://www.volcengine.com/docs/82379

type ArkMessage = { role: "system" | "user" | "assistant"; content: string };

export async function generateAiFeedback(
  userState: AiUserState,
  persona: PersonaId = "bro"
): Promise<{ text: string; ok: true } | { text: null; ok: false; error: string }> {
  const apiKey = process.env.ARK_API_KEY;
  const baseUrl = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
  const model = process.env.ARK_MODEL || "doubao-pro-32k";

  if (!apiKey) {
    return { text: null, ok: false, error: "ARK_API_KEY 未配置" };
  }

  // 在后端再强制一次保护模式判定（不依赖 AI 自觉）
  const effectiveRoast =
    userState.roast_enabled &&
    userState.age >= MINOR_AGE &&
    userState.consecutive_fail < PROTECTION_MODE_THRESHOLD;

  const userMsg = buildUserMessage(userState, effectiveRoast);

  const messages: ArkMessage[] = [
    { role: "system", content: getPersonaSystemPrompt(persona) },
    ...getPersonaFewShot(persona),
    { role: "user", content: userMsg },
  ];

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.9, // 略高，让反馈更多样
        max_tokens: 120,
        top_p: 0.9,
      }),
      // 豆包 API 偶尔会慢
      next: { revalidate: 0 },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[doubao] API error", resp.status, errText);
      return { text: null, ok: false, error: `豆包 API ${resp.status}` };
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() ?? "";

    if (!text) {
      return { text: null, ok: false, error: "AI 返回空内容" };
    }

    // 本地敏感词二次过滤
    if (containsBannedWord(text)) {
      console.warn("[doubao] 输出命中敏感词，已拦截:", text);
      return {
        text: null,
        ok: false,
        error: "AI 输出命中敏感词",
      };
    }

    return { text, ok: true };
  } catch (e) {
    console.error("[doubao] 调用异常", e);
    return { text: null, ok: false, error: "网络异常" };
  }
}

function buildUserMessage(state: AiUserState, effectiveRoast: boolean): string {
  const goalLabel = GOAL_TYPES[state.goal_type]?.label ?? state.goal_type;
  const diffLabel = DIFFICULTIES[state.difficulty]?.label ?? state.difficulty;
  return [
    `用户情况：${state.scenario}`,
    `目标：${goalLabel}`,
    `难度：${diffLabel}`,
    `连续天数：${state.streak}`,
    `历史失败：${state.consecutive_fail}`,
    `年龄：${state.age}`,
    `毒舌模式：${effectiveRoast ? "开" : "关（强制纯夸夸）"}`,
  ].join("，");
}

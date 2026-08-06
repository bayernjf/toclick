import { NextResponse } from "next/server";
import { PERSONA_MAP } from "@/lib/ai/persona";
import type { PersonaId } from "@/lib/ai/persona";

// GET /api/iap/products
// Returns available IAP products (premium personas for future purchase)
// Currently returns available premium personas; purchase flow to be wired to
// a payment provider (e.g. Stripe, Lemon Squeezy, RevenueCat)
export async function GET(): Promise<NextResponse> {
  const products = (Object.keys(PERSONA_MAP) as PersonaId[])
    .filter((key) => PERSONA_MAP[key].isPremium)
    .map((key) => ({
      id: `premium_persona_${key}`,
      type: "persona",
      persona_id: key,
      name: PERSONA_MAP[key].label,
      emoji: PERSONA_MAP[key].emoji,
      description: PERSONA_MAP[key].desc,
      price: 0, // placeholder — to be filled by payment provider
    }));

  return NextResponse.json({ ok: true, products });
}

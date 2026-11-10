import { describe, it, expect, afterEach, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type Header = { key: string; value: string };
type NextConfig = {
  headers: () => Promise<Array<{ source: string; headers: Header[] }>>;
};

async function scriptSrcDirective(nodeEnv: string): Promise<string> {
  vi.stubEnv("NODE_ENV", nodeEnv);
  const config = require("../../next.config.js") as NextConfig;
  const [{ headers }] = await config.headers();
  const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value;
  expect(csp).toBeTruthy();
  const directive = csp?.split("; ").find((d) => d.startsWith("script-src"));
  expect(directive).toBeTruthy();
  return directive as string;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CSP script-src", () => {
  it("production 不放行 'unsafe-eval'", async () => {
    const directive = await scriptSrcDirective("production");
    expect(directive).not.toContain("'unsafe-eval'");
    expect(directive).toContain("'self'");
  });

  it("development 保留 'unsafe-eval'（Next dev 的 eval-source-map 需要）", async () => {
    const directive = await scriptSrcDirective("development");
    expect(directive).toContain("'unsafe-eval'");
  });
});

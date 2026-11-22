import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

describe("proxy", () => {
  it("only watches /admin, so a stale cookie can never bounce sign-in and dashboard off each other", () => {
    expect(config.matcher).toEqual(["/admin/:path*"]);
    for (const m of config.matcher) expect(m.startsWith("/admin")).toBe(true);
  });

  it("answers /admin with a 404 rewrite when there is no session cookie", () => {
    const res = proxy(req("/admin/staff"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/404");
  });

  it("lets /admin through when a session cookie is present (the layout checks it for real)", () => {
    const res = proxy(req("/admin", "better-auth.session_token=anything"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

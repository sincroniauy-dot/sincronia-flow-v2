// tests/protected.spec.ts
import { describe, it, expect } from "vitest";
import { GET } from "../app/api/protected/route";
import { signInTester } from "./helpers/auth";

describe("/api/protected", () => {
  it("devuelve uid/email/role con token válido", async () => {
    const { token, email } = await signInTester();
    const req = new Request("http://localhost/api/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.email).toBe(email);
    expect(["admin", "supervisor", "gestor"]).toContain(body.role);
  });

  it("devuelve 401 sin token", async () => {
    const req = new Request("http://localhost/api/protected");
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });
});

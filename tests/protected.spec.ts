import { describe, it, expect } from "vitest";
import { signInTester } from "./helpers/auth";

const BASE = "http://localhost:3000";

describe("/api/protected", () => {
  it("devuelve uid/email/role con token válido", async () => {
    const { token, email } = await signInTester();
    const res = await fetch(`${BASE}/api/protected`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.email).toBe(email);
    expect(json.uid).toBeTruthy();
    expect(json.role).toBeTruthy();
  });

  it("devuelve 401 sin token", async () => {
    const res = await fetch(`${BASE}/api/protected`);
    expect(res.status).toBe(401);
  });
});

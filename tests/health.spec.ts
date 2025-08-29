// tests/health.spec.ts
import { describe, it, expect } from "vitest";
import { GET } from "../app/api/health/route"; // ruta relativa desde /tests

describe("/api/health", () => {
  it("responde 200 y ok=true", async () => {
    const res = await GET(new Request("http://localhost/api/health") as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // projectId puede estar o no; si está, no es "unknown"
    if (body.projectId) {
      expect(typeof body.projectId).toBe("string");
    }
  });
});

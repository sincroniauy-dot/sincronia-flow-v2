import { describe, it, expect } from "vitest";
import { signInTester } from "./helpers/auth";

const BASE = "http://localhost:3000";

describe("/api/payments", () => {
  it("lista pagos, crea uno nuevo, obtiene por id y permite PATCH con ETag", async () => {
    const { token } = await signInTester();
    const H = { Authorization: `Bearer ${token}` };

    // 1) Tomar un caseId válido
    const casesRes = await fetch(`${BASE}/api/cases`, { headers: H });
    expect(casesRes.status).toBe(200);
    const casesJson = await casesRes.json();
    const caseId = casesJson.data[0].id as string;
    expect(caseId).toBeTruthy();

    // 2) Crear pago FRESCO (estado posted)
    const createRes = await fetch(`${BASE}/api/payments`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId,
        amount: 123,
        method: "cash",
        date: new Date().toISOString(),
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const payId = created.id as string;
    expect(payId).toBeTruthy();

    // 3) GET por id para obtener ETag
    const one = await fetch(`${BASE}/api/payments/${payId}`, { headers: H });
    expect(one.status).toBe(200);
    const etag = one.headers.get("ETag");
    expect(etag).toBeTruthy();

    // 4) PATCH con ETag correcto
    const ok = await fetch(`${BASE}/api/payments/${payId}`, {
      method: "PATCH",
      headers: { ...H, "If-Match": etag!, "Content-Type": "application/json" },
      body: JSON.stringify({ note: "QA patch", metadata: { qa: true } }),
    });
    expect(ok.status).toBe(200);

    // 5) PATCH con ETag incorrecto -> 412
    const bad = await fetch(`${BASE}/api/payments/${payId}`, {
      method: "PATCH",
      headers: { ...H, "If-Match": "BAD-ETAG", "Content-Type": "application/json" },
      body: JSON.stringify({ note: "no debe aplicar" }),
    });
    expect(bad.status).toBe(412);
  });
});

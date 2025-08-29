import { describe, it, expect } from "vitest";
import { signInTester } from "./helpers/auth";

const BASE = "http://localhost:3000";

describe("/api/cancellations", () => {
  it("/api/cancellations: POST cancelar pago, listar por caseId, GET por id, pago queda cancelled", async () => {
    const { token } = await signInTester();
    const H = { Authorization: `Bearer ${token}` };

    // 1) Case válido
    const casesRes = await fetch(`${BASE}/api/cases`, { headers: H });
    expect(casesRes.status).toBe(200);
    const casesJson = await casesRes.json();
    const caseId = casesJson.data[0].id as string;

    // 2) Crear pago FRESCO para cancelar
    const createRes = await fetch(`${BASE}/api/payments`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId,
        amount: 111,
        method: "card",
        date: new Date().toISOString(),
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const payId = created.id as string;

    // 3) Cancelar (debe dar 201, no 409)
    const cancelRes = await fetch(`${BASE}/api/cancellations`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payId, reason: "QA - test" }),
    });
    expect(cancelRes.status).toBe(201);
    const cancelJson = await cancelRes.json();
    const cancId = cancelJson.id as string;
    expect(cancId).toBeTruthy();

    // 4) Listar por caseId (debe incluir la cancelación)
    const list = await fetch(`${BASE}/api/cancellations?caseId=${caseId}`, {
      headers: H,
    });
    expect(list.status).toBe(200);
    const listJson = await list.json();
    expect(Array.isArray(listJson.data)).toBe(true);
    const found = listJson.data.find((x: any) => x.id === cancId);
    expect(found).toBeTruthy();

    // 5) GET por id
    const getOne = await fetch(`${BASE}/api/cancellations/${cancId}`, {
      headers: H,
    });
    expect(getOne.status).toBe(200);

    // 6) Verificar pago quedó cancelled
    const pay = await fetch(`${BASE}/api/payments/${payId}`, { headers: H });
    expect(pay.status).toBe(200);
    const payJson = await pay.json();
    expect(payJson.status).toBe("cancelled");
  });

  it("/api/cancellations: 401 sin token", async () => {
    const res = await fetch(`${BASE}/api/cancellations`);
    expect(res.status).toBe(401);
  });
});

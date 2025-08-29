// tests/payments.spec.ts
import { describe, it, expect } from "vitest";
import * as paymentsRoot from "../app/api/payments/route";
import * as paymentsId from "../app/api/payments/[id]/route";
import { signInTester } from "./helpers/auth";

// helper para crear Request con JSON
function jsonRequest(url: string, method: string, headers: Record<string, string>, body?: any) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/payments", () => {
  it("lista pagos, obtiene uno por id y permite PATCH con ETag", async () => {
    const { token } = await signInTester();
    const H = { Authorization: `Bearer ${token}` };

    // GET list
    const resList = await paymentsRoot.GET(jsonRequest("http://localhost/api/payments", "GET", H) as any);
    expect(resList.status).toBe(200);
    const list = await resList.json();
    expect(Array.isArray(list.data)).toBe(true);
    expect(list.data.length).toBeGreaterThan(0);

    const first = list.data[0];
    const id = first.id as string;
    expect(id).toBeTruthy();

    // GET by id (para leer ETag)
    const resGet = await paymentsId.GET(new Request(`http://localhost/api/payments/${id}`, { headers: H }) as any, { params: { id } } as any);
    expect(resGet.status).toBe(200);
    const etag = resGet.headers.get("ETag");
    expect(etag).toBeTruthy();

    // PATCH con If-Match correcto
    const patchBody = { note: "QA patch vitest", metadata: { qa: true } };
    const reqPatch = jsonRequest(`http://localhost/api/payments/${id}`, "PATCH", { ...H, "If-Match": String(etag) }, patchBody);
    const resPatch = await paymentsId.PATCH(reqPatch as any, { params: { id } } as any);
    expect([200, 204]).toContain(resPatch.status);
    const patched = await resPatch.json();
    expect(patched.id).toBe(id);
    expect(patched.note).toBe("QA patch vitest");

    // PATCH con If-Match incorrecto → 412
    const badReq = jsonRequest(`http://localhost/api/payments/${id}`, "PATCH", { ...H, "If-Match": "BAD-ETAG" }, { note: "should fail" });
    const badRes = await paymentsId.PATCH(badReq as any, { params: { id } } as any);
    expect(badRes.status).toBe(412);
  });
});

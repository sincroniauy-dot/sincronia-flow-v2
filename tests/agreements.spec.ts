import { expect, test } from "vitest";
import { getIdToken } from "./helpers/auth";

const PORT = 3000;
const BASE = `http://localhost:${PORT}`;

test("/api/agreements: crea, lista por caseId, GET por id, PATCH con ETag, 412 si ETag malo", async () => {
  // 1) token
  const token = await getIdToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 2) sanity /protected
  const prot = await fetch(`${BASE}/api/protected`, { headers });
  expect(prot.status).toBe(200);

  // 3) obtener caseId válido
  const casesRes = await fetch(`${BASE}/api/cases`, { headers });
  expect(casesRes.status).toBe(200);
  const casesJson = await casesRes.json();
  const caseId = casesJson.data[0].id as string;

  // 4) crear acuerdo
  const bodyCreate = {
    caseId,
    amount: 1200,
    startDate: new Date().toISOString(),
    installments: 6,
    terms: { frequency: "monthly", graceDays: 5 }
  };
  const createRes = await fetch(`${BASE}/api/agreements`, { method: "POST", headers, body: JSON.stringify(bodyCreate) });
  expect(createRes.status).toBe(201);
  const created = await createRes.json();
  const agId = created.id as string;
  expect(agId).toBeTruthy();

  // 5) listar por caseId
  const listRes = await fetch(`${BASE}/api/agreements?caseId=${caseId}`, { headers });
  expect(listRes.status).toBe(200);

  // 6) GET por id
  const getRes = await fetch(`${BASE}/api/agreements/${agId}`, { headers });
  expect(getRes.status).toBe(200);

  // 7) ETag actual
  const etag = getRes.headers.get("ETag");
  expect(etag).toBeTruthy();

  // 8) PATCH terms con ETag correcto
  const patch1 = await fetch(`${BASE}/api/agreements/${agId}`, {
    method: "PATCH",
    headers: { ...headers, "If-Match": etag! },
    body: JSON.stringify({ terms: { frequency: "monthly", graceDays: 3 } })
  });
  expect(patch1.status).toBe(200);

  // 9) PATCH con ETag incorrecto -> 412
  const patch412 = await fetch(`${BASE}/api/agreements/${agId}`, {
    method: "PATCH",
    headers: { ...headers, "If-Match": "BAD-ETAG" },
    body: JSON.stringify({ terms: { frequency: "monthly", graceDays: 2 } })
  });
  expect(patch412.status).toBe(412);
});

test("/api/agreements: 401 sin token", async () => {
  const res = await fetch(`${BASE}/api/agreements`);
  expect(res.status).toBe(401);
});

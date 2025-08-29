// lib/audit.ts
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export type AuditEntry = {
  entity: "payment" | "agreement" | "cancellation" | string;
  entityId: string;
  action: "create" | "update" | "status_change" | "delete" | string;
  by: string; // uid
  at?: FirebaseFirestore.FieldValue; // serverTimestamp
  diff?: Record<string, any>;
  meta?: Record<string, any>;
};

export async function writeAudit(entry: AuditEntry) {
  const db = getFirestore();
  const doc = {
    ...entry,
    at: FieldValue.serverTimestamp(), // ¡NO va dentro de un array!
  };
  await db.collection("auditLogs").add(doc);
}

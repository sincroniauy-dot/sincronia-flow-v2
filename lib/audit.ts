// lib/audit.ts
import { db } from "./firebaseAdmin";

export type AuditLog = {
  entity: string;
  entityId?: string;
  action: string;
  by?: string;
  meta?: any;
  at?: Date;
};

export async function writeAuditLog(entry: AuditLog) {
  const doc = { ...entry, at: entry.at ?? new Date() };
  await db.collection("auditLogs").add(doc);
  return doc;
}

// (opcional) default para compatibilidad si en algún lado hicieron import default
export default {
  writeAuditLog
};

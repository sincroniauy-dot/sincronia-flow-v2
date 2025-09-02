import { db } from "./firebaseAdmin";

type AuditEntry = {
  entity: string;
  entityId: string;
  action: string;
  by?: string;
  meta?: any;
  at?: Date;
};

export async function writeAuditLog(entry: Omit<AuditEntry, "at">): Promise<void> {
  await db.collection("auditLogs").add({
    ...entry,
    at: new Date()
  });
}

export async function listAuditLogs(entity: string, entityId: string, limit = 20) {
  const snap = await db
    .collection("auditLogs")
    .where("entity", "==", entity)
    .where("entityId", "==", entityId)
    .orderBy("at", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Default para compatibilidad si en algún lado se hacía import default
export default { writeAuditLog };

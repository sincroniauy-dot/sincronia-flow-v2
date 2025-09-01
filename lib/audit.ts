import { db } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function writeAuditLog(
  action: string,
  entity: string,
  entityId: string,
  userId: string,
  data?: Record<string, any>
) {
  await db.collection("auditLogs").add({
    action,
    entity,
    entityId,
    userId,
    data: data || {},
    createdAt: FieldValue.serverTimestamp(),
  });
}
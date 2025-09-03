// lib/audit.ts
import { db, getAdminApp } from "./firebaseAdmin";

type AuditEntry = {
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  // Permite apagar el audit en local sin romper endpoints
  if (process.env.AUDIT_DISABLED === "1" || process.env.AUDIT_DISABLED === "true") {
    console.log("[audit:disabled]", entry);
    return;
  }

  try {
    const app = getAdminApp();
    if (!app || !db) {
      console.warn("[audit] Firebase Admin no inicializado; se omite escritura");
      return;
    }

    await db.collection("auditLogs").add({
      ...entry,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[audit] fallo al escribir; continúo", e);
  }
}

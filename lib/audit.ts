import { db } from "./firebaseAdmin";

export type AuditEntry = {
  actor?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

/**
 * writeAuditLog: implementación segura y silenciosa para CI.
 * En producción guarda en la colección 'audit'.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const payload = { ...entry, createdAt: new Date() };
    await db.collection("audit").add(payload as any);
  } catch (e) {
    // No rompemos el flujo por un error de auditoría
    console.warn("[audit] writeAuditLog failed:", (e as Error)?.message);
  }
}

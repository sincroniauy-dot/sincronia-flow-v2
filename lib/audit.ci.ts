export type AuditLog = {
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Stub solo para CI/typecheck.
 */
export async function writeAuditLog(_entry: AuditLog): Promise<void> {
  // no-op
}

export default writeAuditLog;

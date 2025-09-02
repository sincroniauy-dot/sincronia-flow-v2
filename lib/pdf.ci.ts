export type CancellationPdfOptions = {
  id: string;
  notes?: string;
  templateVersion?: string;
};

/**
 * Stub solo para CI/typecheck.
 * Devuelve un Uint8Array vacío; no se usa en ejecución.
 */
export async function renderCancellationPdf(
  _opts: CancellationPdfOptions
): Promise<Uint8Array> {
  return new Uint8Array(0);
}

export default renderCancellationPdf;

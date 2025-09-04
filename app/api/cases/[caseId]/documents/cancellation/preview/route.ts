// app/api/cases/[caseId]/documents/cancellation/preview/route.ts
import { NextResponse } from 'next/server';

// PDF placeholder (válido pero mínimo)
function buildPlaceholderPdf(params: {
  debtorName: string;
  debtorId: string;
  creditorName: string;
  operationNumber: string;
  product: string;
  totalWithInterest: number;
  settlementDescription: string;
  settlementAmount: number;
  settlementDates: string[];
  signatoryName: string;
  signatoryTitle: string;
  signatoryMat: string;
}) {
  const text =
    `SINCRONÍA - PREVIEW CARTA (PLACEHOLDER)\n` +
    `Titular: ${params.debtorName} (${params.debtorId})\n` +
    `Acreedor: ${params.creditorName}\n` +
    `Operación: ${params.operationNumber} | Producto: ${params.product}\n` +
    `Total con intereses: ${params.totalWithInterest}\n` +
    `Arreglo: ${params.settlementDescription} - Monto: ${params.settlementAmount}\n` +
    `Fechas: ${params.settlementDates.join(', ')}\n` +
    `Firmante: ${params.signatoryName} - ${params.signatoryTitle} - Mat. ${params.signatoryMat}\n` +
    `\n(En el próximo bloque reemplazamos este placeholder por el PDF definitivo de tu plantilla.)\n`;

  // Construimos un PDF súper simple (texto plano) como placeholder
  // Formato mínimo PDF
  const content = `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${text.length + 91} >> stream
BT /F1 12 Tf 72 720 Td (${text.replace(/\n/g, ') Tj\n0 -14 Td (').replace(/[()]/g, m => '\\' + m)}) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000061 00000 n 
0000000119 00000 n 
0000000333 00000 n 
0000000534 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
634
%%EOF`;

  return Buffer.from(content, 'utf-8');
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const body = await req.json();
    const pdf = buildPlaceholderPdf({
      debtorName: body.debtorName,
      debtorId: body.debtorId,
      creditorName: body.creditorName,
      operationNumber: body.operationNumber,
      product: body.product,
      totalWithInterest: body.totalWithInterest,
      settlementDescription: body.settlementDescription,
      settlementAmount: body.settlementAmount,
      settlementDates: body.settlementDates || [],
      signatoryName: body.signatoryName,
      signatoryTitle: body.signatoryTitle,
      signatoryMat: body.signatoryMat,
    });

    const base64 = pdf.toString('base64');
    return NextResponse.json({ ok: true, caseId: params.caseId, pdfBase64: base64 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'preview-failed' }, { status: 400 });
  }
}

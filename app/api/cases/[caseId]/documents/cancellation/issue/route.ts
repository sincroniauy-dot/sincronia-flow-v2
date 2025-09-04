// app/api/cases/[caseId]/documents/cancellation/issue/route.ts
import { NextResponse } from 'next/server';
import { getBucket } from '@/lib/gcs';

function buildPlaceholderPdf(body: any) {
  const text =
    `SINCRONÍA - ISSUE CARTA (PLACEHOLDER)\n` +
    `Titular: ${body.debtorName} (${body.debtorId})\n` +
    `Acreedor: ${body.creditorName}\n` +
    `Operación: ${body.operationNumber} | Producto: ${body.product}\n` +
    `Total con intereses: ${body.totalWithInterest}\n` +
    `Arreglo: ${body.settlementDescription} - Monto: ${body.settlementAmount}\n` +
    `Fechas: ${(body.settlementDates || []).join(', ')}\n` +
    `Firmante: ${body.signatoryName} - ${body.signatoryTitle} - Mat. ${body.signatoryMat}\n`;
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
    const pdf = buildPlaceholderPdf(body);

    const bucket = getBucket();
    const docId = `${params.caseId}-${Date.now()}`;
    const objectPath = `documents/cancellation/${docId}.pdf`;

    const file = bucket.file(objectPath);
    await file.save(pdf, { contentType: 'application/pdf', resumable: false, public: false, metadata: { cacheControl: 'private, max-age=0' } });

    return NextResponse.json({ ok: true, caseId: params.caseId, docId, path: objectPath });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'issue-failed' }, { status: 400 });
  }
}

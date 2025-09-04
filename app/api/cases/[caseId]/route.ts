// app/api/cases/[caseId]/route.ts
import { NextResponse } from 'next/server';
// Import RELATIVO para evitar issues con el alias "@/":
import { db } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { caseId: string } }) {
  try {
    const firestore = db();
    const ref = await firestore.collection('cases').doc(params.caseId).get();
    if (!ref.exists) {
      return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: params.caseId, ...ref.data() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'read-failed' }, { status: 500 });
  }
}

// app/api/interactions/list/route.ts
import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/interactions/list?caseId=C-1
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get('caseId');
    if (!caseId) return NextResponse.json({ ok: false, error: 'caseId required' }, { status: 400 });

    const firestore = db();
    // Solo WHERE (sin orderBy) para NO requerir índice
    const snap = await firestore.collection('interactions')
      .where('caseId', '==', caseId)
      .limit(200)
      .get();

    // Ordenar por ts en memoria (desc)
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.ts).localeCompare(String(a.ts)));

    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'list-failed' }, { status: 500 });
  }
}

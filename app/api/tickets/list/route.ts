// app/api/tickets/list/route.ts
import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/tickets/list?status=OPEN
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'OPEN';

    const firestore = db();
    const snap = await firestore.collection('tickets')
      .where('status', '==', status)
      .limit(100)
      .get();

    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'tickets-list-failed' }, { status: 500 });
  }
}

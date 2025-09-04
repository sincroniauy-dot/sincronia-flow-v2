// app/api/tickets/reject/route.ts
import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/tickets/reject { ticketId, reason }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, reason } = body;
    if (!ticketId) return NextResponse.json({ ok:false, error:'ticketId required' }, { status:400 });

    const firestore = db();
    const ref = firestore.collection('tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok:false, error:'ticket not found' }, { status:404 });

    const ticket = snap.data()!;
    if (ticket.status !== 'OPEN') {
      return NextResponse.json({ ok:false, error:'ticket not open' }, { status:400 });
    }

    const closedAt = new Date().toISOString();
    await ref.update({ status:'CLOSED', closedAt, rejected:true, rejectReason: reason || null });

    // Por defecto, no cambiamos estado del caso (permanece como estaba: PROMESA)
    // Si quisieras retrocederlo, acá se haría con ticket.prevState.
    return NextResponse.json({ ok:true, rejected:true, ticketId, caseId: ticket.caseId });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message || 'reject-failed' }, { status:500 });
  }
}

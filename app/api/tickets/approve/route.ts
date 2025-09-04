// app/api/tickets/approve/route.ts
import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/tickets/approve { ticketId }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticketId } = body;
    if (!ticketId) return NextResponse.json({ ok: false, error: 'ticketId required' }, { status: 400 });

    const firestore = db();
    const ref = firestore.collection('tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'ticket not found' }, { status: 404 });

    const ticket = snap.data()!;
    if (ticket.status !== 'OPEN') {
      return NextResponse.json({ ok: false, error: 'ticket not open' }, { status: 400 });
    }

    // Cerrar ticket
    const closedAt = new Date().toISOString();
    await ref.update({ status: 'CLOSED', closedAt });

    // OJO: el diseño del ticket usa "proposedState" (no nextState)
    const next = ticket.proposedState || ticket.nextState;

    if (ticket.caseId && next) {
      await firestore.collection('cases').doc(ticket.caseId).set(
        { state: next, updatedAt: closedAt },
        { merge: true }
      );
    }

    return NextResponse.json({ ok: true, applied: true, ticketId, caseId: ticket.caseId, newState: next || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'approve-failed' }, { status: 500 });
  }
}

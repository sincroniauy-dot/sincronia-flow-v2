// app/api/interactions/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Fields = Record<string, any>;

function loadJSON<T = any>(rel: string): T {
  const p = path.join(process.cwd(), rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const stateMachine = loadJSON<{states: string[]; transitions: Record<string,string[]>}>('config/seeds/stateMachine.json');
const resultsByState = loadJSON<Record<string,string[]>>('config/seeds/resultsByState.json');
const fieldsMatrix  = loadJSON<Record<string, any>>('config/seeds/fieldsMatrix.json');

function validateResultAllowed(state: string, result: string) {
  const allowed = resultsByState[state] || [];
  return { allowed, ok: allowed.includes(result) };
}

function requiredFieldsFor(result: string, concept?: string) {
  const spec = fieldsMatrix[result] || {};
  if (spec.variants) {
    if (!concept) {
      return { ok: false, required: [], message: `"${result}" requiere CONCEPTO (${Object.keys(spec.variants).join(' | ')})` };
    }
    const v = spec.variants[concept];
    if (!v) {
      return { ok: false, required: [], message: `Concepto "${concept}" inválido para "${result}". Válidos: ${Object.keys(spec.variants).join(' | ')}` };
    }
    return { ok: true, required: v as string[], message: null };
  }
  return { ok: true, required: (spec.required || []) as string[], message: null };
}

function validateTransition(from: string, to: string) {
  const allowed = stateMachine.transitions[from] || [];
  return { allowed, ok: allowed.includes(to) };
}

function businessRules(opts: {
  currentState: string;
  result: string;
  concept?: 'CONTADO' | 'ENTREGA_CONVENIO' | 'PAGOS_A_CUENTA';
  lastPromiseConcept?: 'CONTADO' | 'ENTREGA_CONVENIO' | 'PAGOS_A_CUENTA';
  fields: Fields;
}) {
  const { currentState, result, concept, lastPromiseConcept, fields } = opts;

  let suggestedNextState: string | null = null;
  const actions: any[] = [];
  let supervisorRequired = false;
  const notes: string[] = [];

  if (result === 'PROMESA_DE_PAGO') {
    // se registra promesa; estado sigue en PROMESA
  }

  if (result === 'CONFIRMA_HABER_PAGO') {
    const effectiveConcept = lastPromiseConcept || concept;
    if (effectiveConcept === 'CONTADO') {
      supervisorRequired = true;
      suggestedNextState = 'CANCELADO';
      actions.push({ type: 'CREATE_SUPERVISOR_TICKET', reason: 'Validar pago de cancelación contado' });
      notes.push('Al aprobar supervisor, cambiar a CANCELADO.');
    } else if (effectiveConcept === 'ENTREGA_CONVENIO') {
      suggestedNextState = 'TRANSACCION';
      actions.push({
        type: 'ACTIVATE_AGREEMENT',
        agreementType: 'CONVENIO',
        data: {
          entregaMonto: fields.entregaMonto,
          entregaFecha: fields.entregaFecha,
          cuotasTotales: fields.cuotasTotales,
          montoCuota: fields.montoCuota,
          segundaCuotaVence: fields.segundaCuotaVence
        }
      });
    } else if (effectiveConcept === 'PAGOS_A_CUENTA') {
      suggestedNextState = 'TRANSACCION';
      actions.push({
        type: 'ACTIVATE_AGREEMENT',
        agreementType: 'PAGOS_A_CUENTA',
        data: {
          entregaMonto: fields.entregaMonto,
          entregaFecha: fields.entregaFecha,
          pagosACuentaTotales: fields.pagosACuentaTotales,
          montoPorPago: fields.montoPorPago,
          segundaCuotaVence: fields.segundaCuotaVence
        }
      });
    }
  }

  if (result === 'CONFIRMA_PAGO_DE_CUOTA') {
    actions.push({ type: 'REGISTER_INSTALLMENT_PAYMENT' });
  }

  return { suggestedNextState, supervisorRequired, actions, notes };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const caseId = (body.caseId || '').trim();
    const currentState = (body.currentState || '').trim();
    const result = (body.result || '').trim();
    const concept = body.concept as any;
    const targetState = body.targetState ? String(body.targetState).trim() : undefined;
    const lastPromiseConcept = body.lastPromiseConcept as any;
    const fields: Fields = body.fields || {};
    const actorId = (body.actorId || 'system'); // opcional

    if (!caseId || !currentState || !result) {
      return NextResponse.json({ ok: false, error: 'Faltan campos: caseId/currentState/result' }, { status: 400 });
    }
    if (!stateMachine.states.includes(currentState)) {
      return NextResponse.json({ ok: false, error: `Estado actual inválido: ${currentState}` }, { status: 400 });
    }

    const resAllowed = validateResultAllowed(currentState, result);
    if (!resAllowed.ok) {
      return NextResponse.json({
        ok: false,
        error: `Resultado "${result}" no permitido en estado "${currentState}"`,
        allowedResults: resAllowed.allowed
      }, { status: 409 });
    }

    const rf = requiredFieldsFor(result, concept);
    if (!rf.ok) {
      return NextResponse.json({ ok: false, error: rf.message }, { status: 400 });
    }
    const missing = rf.required.filter((k: string) => fields[k] === undefined || fields[k] === null || String(fields[k]).trim() === '');
    if (missing.length) {
      return NextResponse.json({ ok: false, error: 'Faltan campos requeridos', missing }, { status: 400 });
    }

    const br = businessRules({ currentState, result, concept, lastPromiseConcept, fields });

    // Determinar nextState
    let nextState = currentState;
    let transitionInfo: any = null;

    if (targetState) {
      const t = validateTransition(currentState, targetState);
      if (!t.ok) {
        return NextResponse.json({
          ok: false,
          error: `Transición bloqueada: ${currentState} → ${targetState}`,
          allowedNext: t.allowed
        }, { status: 409 });
      }
      nextState = targetState;
      transitionInfo = { chosenByUser: true };
    } else if (br.suggestedNextState) {
      const t = validateTransition(currentState, br.suggestedNextState);
      if (t.ok) {
        if (br.supervisorRequired) {
          transitionInfo = { proposed: br.suggestedNextState, requiresSupervisor: true };
          nextState = currentState; // esperar aprobación
        } else {
          nextState = br.suggestedNextState;
          transitionInfo = { appliedSuggested: true };
        }
      } else {
        transitionInfo = { suggestedButBlocked: br.suggestedNextState, allowedNext: t.allowed };
      }
    }

    // --- Persistencia ---
    const firestore = db();
    const now = new Date();

    // 1) Guardar interacción
    const interRef = await firestore.collection('interactions').add({
      caseId,
      actorId,
      ts: now.toISOString(),
      fromState: currentState,
      result,
      concept: concept || null,
      fields,
      lastPromiseConcept: lastPromiseConcept || null,
      transitionInfo,
      suggestedNextState: br.suggestedNextState || null,
      supervisorRequired: br.supervisorRequired,
      actions: br.actions,
      notes: br.notes
    });

    // 2) Actualizar estado del caso (si corresponde)
    const caseRef = firestore.collection('cases').doc(caseId);
    await caseRef.set(
      { state: nextState, updatedAt: now.toISOString() },
      { merge: true }
    );

    // 3) Ticket a supervisor (si corresponde)
    let supervisorTicketId: string | null = null;
    if (br.supervisorRequired) {
      const tRef = await firestore.collection('tickets').add({
        caseId,
        interactionId: interRef.id,
        type: 'SUPERVISOR_VALIDATION',
        reason: 'Validar pago de cancelación contado',
        proposedState: 'CANCELADO',
        status: 'OPEN',
        createdAt: now.toISOString()
      });
      supervisorTicketId = tRef.id;
    }

    return NextResponse.json({
      ok: true,
      caseId,
      currentState,
      result,
      concept: concept || null,
      lastPromiseConcept: lastPromiseConcept || null,
      requiredFields: rf.required,
      nextState,
      transitionInfo,
      supervisorRequired: br.supervisorRequired,
      supervisorTicketId,
      actions: br.actions,
      notes: br.notes,
      interactionId: interRef.id
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'interaction-failed' }, { status: 500 });
  }
}

'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, getAuth } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';

type Msg = { level: 'ok' | 'warn' | 'err'; text: string };

export default function TestPage() {
  const [email, setEmail] = useState('demo.user@sincronia.test');
  const [password, setPassword] = useState('Demo#2025');
  const [msg, setMsg] = useState<Msg | null>(null);
  const [lastJson, setLastJson] = useState<any>(null);

  const set = (level: Msg['level'], text: string) => setMsg({ level, text });

  const login = async () => {
    try {
      set('warn', 'Haciendo login...');
      await signInWithEmailAndPassword(auth, email, password);
      const u = auth.currentUser;
      set('ok', `Login OK. UID: ${u?.uid} | Email: ${u?.email}`);
    } catch (e: any) {
      set('err', `Error login: ${e?.message || e}`);
    }
  };

  const callProtected = async () => {
    try {
      set('warn', 'Llamando /api/protected ...');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        set('err', 'No hay usuario logueado (token ausente)');
        return;
      }
      const r = await fetch('/api/protected', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      setLastJson(j);
      set('ok', `Protected -> ${r.status} ${JSON.stringify(j)}`);
    } catch (e: any) {
      set('err', `Error protected: ${e?.message || e}`);
    }
  };

  const seeMyRole = async () => {
    try {
      set('warn', 'Consultando mi rol ...');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        set('err', 'No hay usuario logueado (token ausente)');
        return;
      }
      // Reutilizamos /api/protected para obtener claims/uid/email
      const r = await fetch('/api/protected', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      setLastJson(j);
      const role = j?.role ?? '(sin claim de rol)';
      set('ok', `Rol: ${role} | UID: ${j?.uid} | Email: ${j?.email}`);
    } catch (e: any) {
      set('err', `Error al leer rol: ${e?.message || e}`);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
      <h1>Prueba Firebase (cliente)</h1>

      <div
        style={{
          background: '#111',
          color: '#ddd',
          padding: 16,
          borderRadius: 8,
          margin: '12px 0',
          whiteSpace: 'pre-wrap',
        }}
      >
        <strong>Status:</strong>{' '}
        {msg ? (
          <span
            style={{
              color: msg.level === 'ok' ? '#9f9' : msg.level === 'err' ? '#f99' : '#ff9',
              fontWeight: 600,
            }}
          >
            {msg.text}
          </span>
        ) : (
          '—'
        )}
        <br />
        <strong>UID:</strong> {auth.currentUser?.uid ?? '-'}
        <br />
        <strong>Email:</strong> {auth.currentUser?.email ?? '-'}
      </div>

      <label>Email</label>
      <br />
      <input
        style={{ width: 480, padding: 8 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />
      <br />

      <label>Password</label>
      <br />
      <input
        type="password"
        style={{ width: 480, padding: 8 }}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />
      <br />

      <button onClick={login} style={{ padding: '8px 14px' }}>
        Login
      </button>{' '}
      <button onClick={callProtected} style={{ padding: '8px 14px' }}>
        Call Protected
      </button>{' '}
      <button onClick={seeMyRole} style={{ padding: '8px 14px' }}>
        Ver mi rol
      </button>

      {lastJson ? (
        <>
          <h3>Última respuesta JSON</h3>
          <pre
            style={{
              background: '#111',
              color: '#ccc',
              padding: 16,
              borderRadius: 8,
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(lastJson, null, 2)}
          </pre>
        </>
      ) : null}
    </div>
  );
}

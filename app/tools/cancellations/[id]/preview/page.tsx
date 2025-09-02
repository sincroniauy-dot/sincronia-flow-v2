'use client';

import { useEffect, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    });

export default function PreviewPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const auth = getAuth(app);
    const off = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = '/login';
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch(`/api/cancellations/${id}/docs/preview`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      });
      if (!res.ok) return console.error('Preview error', await res.text());
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    });
    return () => off();
  }, [id]);

  return (
    <div className="h-screen p-4">
      {url ? (
        <iframe src={url} className="w-full h-full rounded-xl shadow" />
      ) : (
        <div className="text-sm text-gray-500">Cargando previsualización…</div>
      )}
    </div>
  );
}

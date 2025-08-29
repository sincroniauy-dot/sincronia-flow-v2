// tests/helpers/auth.ts
export async function signInTester() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
  const email = "tester1@sincronia.test";
  const password = "S1ncro#123";

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`signIn fallo: ${res.status} ${body}`);
  }
  const json = await res.json();
  const token: string = json.idToken;
  const uid: string = json.localId;
  return { token, uid, email };
}

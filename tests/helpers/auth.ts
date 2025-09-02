// tests/helpers/auth.ts

export async function getIdToken(): Promise<string> {
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
    const msg = await res.text();
    throw new Error("Auth failed: " + msg);
  }
  const json = await res.json();
  return json.idToken as string;
}

// Shim para tests existentes que esperan signInTester()
export async function signInTester(): Promise<{ token: string; email: string }> {
  const token = await getIdToken();
  return { token, email: "tester1@sincronia.test" };
}

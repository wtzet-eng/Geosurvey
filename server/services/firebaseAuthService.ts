type FetchLike = typeof fetch;

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

export type FirebaseAuthFailureReason = 'AUTH_NOT_CONFIGURED' | 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'USER_DISABLED' | 'USER_NOT_FOUND';

export type FirebaseAuthResult =
  | { ok: true; user: VerifiedFirebaseUser; reason?: never }
  | { ok: false; reason: FirebaseAuthFailureReason; user?: never };

export async function verifyFirebaseAuthorization(
  authorizationHeader: string | undefined,
  options: { apiKey?: string; fetcher?: FetchLike } = {}
): Promise<FirebaseAuthResult> {
  const apiKey = String(options.apiKey ?? process.env.FIREBASE_WEB_API_KEY ?? '').trim();
  if (!apiKey) return { ok: false, reason: 'AUTH_NOT_CONFIGURED' };

  const match = String(authorizationHeader || '').match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1]?.trim();
  if (!idToken) return { ok: false, reason: 'MISSING_TOKEN' };

  const fetcher = options.fetcher || fetch;
  let response: Response;
  try {
    response = await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
  } catch {
    return { ok: false, reason: 'INVALID_TOKEN' };
  }

  if (!response.ok) return { ok: false, reason: 'INVALID_TOKEN' };
  const data: any = await response.json().catch(() => null);
  const user = Array.isArray(data?.users) ? data.users[0] : null;
  if (!user?.localId) return { ok: false, reason: 'USER_NOT_FOUND' };
  if (user.disabled) return { ok: false, reason: 'USER_DISABLED' };

  return {
    ok: true,
    user: {
      uid: String(user.localId),
      email: typeof user.email === 'string' && user.email ? user.email : null,
      displayName: typeof user.displayName === 'string' && user.displayName ? user.displayName : null,
      emailVerified: Boolean(user.emailVerified)
    }
  };
}

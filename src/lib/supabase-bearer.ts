import { createMiddleware } from "@tanstack/react-start";

// Read the Supabase access token directly from localStorage. We avoid
// supabase.auth.getSession() because it locally validates `iat`, which fails
// with "JWT issued at future" when the managed Supabase clock and the user's
// browser clock disagree. Server-side `requireSupabaseAuth` still validates
// the token against Supabase JWKS.
function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      let raw = window.localStorage.getItem(key);
      if (!raw) continue;
      if (raw.startsWith("base64-")) {
        try {
          raw = atob(raw.slice(7));
        } catch {
          continue;
        }
      }
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
      if (typeof token === "string" && token.length > 0) return token;
    }
  } catch {
    // ignore
  }
  return null;
}

export const attachSupabaseBearer = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = readAccessToken();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);

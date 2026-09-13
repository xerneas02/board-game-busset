export const AUTH_COOKIE = "family_access";

export async function authToken(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`sous-lescalier:${password}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

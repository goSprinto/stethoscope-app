// Checks a token from /connect before the agent stores it (V8-2208): it
// fetches the policy with it, the same call the agent makes right after
// connecting. Resolves (never rejects) to { ok: true }, or { ok: false,
// reason } where reason is "rejected" (Sprinto refused the token) or
// "unreachable" (network error, timeout, server error)
export default async function verifyConnection(getPolicy, baseUrl, accessToken) {
  try {
    await getPolicy(baseUrl, accessToken);
    return { ok: true };
  } catch (err) {
    const status = err && err.response && err.response.status;
    const rejected = status === 401 || status === 403;
    return { ok: false, reason: rejected ? "rejected" : "unreachable", status };
  }
}

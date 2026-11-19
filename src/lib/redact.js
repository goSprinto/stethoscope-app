// Strips credentials from text that is written to, or read back from, the log
// file. Older builds logged whole axios errors, request headers included, so
// log files on disk can still hold the device's bearer token (V8-2207).

const REDACTED = "[REDACTED]";

const PATTERNS = [
  // Authorization: Bearer <token>, in plain text or JSON ("Bearer <token>")
  /(\bBearer\s+)[^\s"'\\,}]+/gi,
  // "accessToken": "<token>" / accessToken=<token> / token: <token>
  /((?:"|')?\b(?:access[_-]?token|token)(?:"|')?\s*[:=]\s*(?:"|')?)[^\s"'\\,}&]+/gi,
];

export default function redact(text) {
  if (typeof text !== "string") return text;
  return PATTERNS.reduce(
    (out, pattern) => out.replace(pattern, `$1${REDACTED}`),
    text
  );
}

// error details that are safe to log: never the request config or headers
export function describeError(err) {
  if (!err) return {};
  return {
    message: err.message,
    code: err.code,
    status: err.response && err.response.status,
  };
}

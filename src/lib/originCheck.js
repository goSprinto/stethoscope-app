// Origin checks for the local API on 127.0.0.1. Every check must match the
// whole Origin: a prefix match lets https://app.sprinto.com.attacker.tld
// pass as https://app.sprinto.com.

// origin of the app's own renderer; start.js rewrites every request from the
// app session to carry it
export const APP_ORIGIN = "drsprinto://main";

// web app origins that may read responses from the local API
const WEB_APP_ORIGINS = [
  "https://app.sprinto.com",
  "https://eu.sprinto.com",
  "https://us.sprinto.com",
  "https://au.sprinto.com",
];

// local dev servers on any port
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/;

// true only when the regex matches the entire string, whether or not the
// pattern is anchored (patterns come from config.yaml)
export function fullMatch(pattern, value) {
  if (typeof value !== "string") return false;
  const match = value.match(new RegExp(pattern));
  return match !== null && match.index === 0 && match[0] === value;
}

// origins allowed by config.yaml: exact allowHosts, or a hostLabels pattern
export function isConfiguredOrigin(origin, { allowHosts = [], hostLabels = [] } = {}) {
  if (typeof origin !== "string") return false;
  if (allowHosts.includes(origin)) return true;
  return hostLabels.some(({ pattern }) => fullMatch(pattern, origin));
}

// origins that get Access-Control-Allow-Origin from the global middleware
export function isWebAppOrigin(origin) {
  if (typeof origin !== "string") return false;
  return (
    origin === APP_ORIGIN ||
    WEB_APP_ORIGINS.includes(origin) ||
    LOCAL_ORIGIN.test(origin)
  );
}

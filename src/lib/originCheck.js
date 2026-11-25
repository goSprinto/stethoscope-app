// Origin checks for the local API on 127.0.0.1. Every check must match the
// whole Origin: a prefix match lets https://app.sprinto.com.attacker.tld
// pass as https://app.sprinto.com.

// origin of the app's own renderer; start.js rewrites every request from the
// app session to carry it
export const APP_ORIGIN = "drsprinto://main";

// the Sprinto regional app hosts: the web app origins that may read
// responses from the local API, and the API base URLs /connect accepts.
// Keep in step with SERVER_HOST in the monolith
// (packages/bridge/src/system/worker/workerConstant.js)
const WEB_APP_ORIGINS = [
  "https://app.sprinto.com",
  "https://eu.sprinto.com",
  "https://in.sprinto.com",
  "https://au.sprinto.com",
  "https://gcc.sprinto.com",
  "https://demo.sprinto.com",
];

// API base URL used by development builds
const DEV_API_ORIGIN = "http://localhost:5000";

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

// the Sprinto API base URL the agent sends its token and reports to, as set
// by /connect. Only the regional hosts over https (plus the local dev server
// in development); returns the normalised origin, or null if not allowed.
// The base URL is joined with "/drsprinto/...", so any path is refused
export function sprintoApiBaseUrl(value, { isDev = false } = {}) {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value);
  } catch (e) {
    return null;
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    return null;
  }
  if (WEB_APP_ORIGINS.includes(url.origin)) return url.origin;
  if (isDev && url.origin === DEV_API_ORIGIN) return url.origin;
  return null;
}

// what to do at startup with the stored API base URL: "keep" an allowed one;
// "default" (use the build's default) when none is stored, since early
// installs connected without storing one; "logout" when a connected device
// has a URL that isn't allowed, so its token is never sent to another host
export function storedBaseUrlAction(baseUrl, isConnected, { isDev = false } = {}) {
  if (sprintoApiBaseUrl(baseUrl, { isDev })) return "keep";
  if (baseUrl && isConnected) return "logout";
  return "default";
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

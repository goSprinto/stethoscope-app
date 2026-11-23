// drsprinto:// links can be opened by any web page, so the agent acts only
// on exact link names, never on a word found anywhere in the link (V8-2293).
// Before, any link containing "update" forced an update and any link
// containing "debugger" opened DevTools.

const SCHEME = "drsprinto:";

// "update" for drsprinto://update, "debugger" for drsprinto://debugger,
// "open" for any other drsprinto:// link (bring the app to the front),
// null for anything that isn't a drsprinto:// link
export function parseDeepLink(value) {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value);
  } catch (e) {
    return null;
  }
  if (url.protocol !== SCHEME) return null;
  const target = `${url.host}${url.pathname}`.replace(/\/+$/, "").toLowerCase();
  if (target === "update") return "update";
  if (target === "debugger") return "debugger";
  return "open";
}

// on Windows the link arrives as a command-line argument; returns that
// argument, or null. Other arguments are never treated as a link
export function deepLinkFromArgv(argv) {
  if (!Array.isArray(argv)) return null;
  const link = argv.find(
    (arg) => typeof arg === "string" && arg.toLowerCase().startsWith(SCHEME)
  );
  return link || null;
}

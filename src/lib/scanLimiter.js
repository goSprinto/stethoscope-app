// Limits how often a caller can start a scan. Every scan runs a batch of
// child processes (system_profiler, fdesetup, ps, ...), so a page that loops
// on /scan drains CPU and battery and churns the app UI (V8-2213).

export default function createScanLimiter({
  maxScans = 10,
  windowMs = 60 * 1000,
  maxConcurrent = 2,
  now = () => Date.now(),
} = {}) {
  const callers = new Map();

  // drop callers with nothing running and no start left in the window, so
  // the map doesn't keep one entry per origin for as long as the app runs
  function prune(cutoff) {
    for (const [key, caller] of callers) {
      caller.starts = caller.starts.filter((t) => t > cutoff);
      if (caller.running === 0 && caller.starts.length === 0) {
        callers.delete(key);
      }
    }
  }

  return {
    // returns a release function, or null when the caller is over a limit
    acquire(key) {
      prune(now() - windowMs);
      if (!callers.has(key)) callers.set(key, { starts: [], running: 0 });
      const caller = callers.get(key);
      if (caller.running >= maxConcurrent || caller.starts.length >= maxScans) {
        return null;
      }
      caller.starts.push(now());
      caller.running += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        caller.running -= 1;
      };
    },

    // number of callers being tracked (for tests)
    size() {
      return callers.size;
    },
  };
}

// query must be a GraphQL string; variables an object or a JSON object
// string. Returns { query, variables } or { error }
export function parseScanRequest(params = {}) {
  const { query, variables } = params || {};
  if (typeof query !== "string" || !query.trim()) {
    return { error: "query must be a non-empty string" };
  }
  if (query.length > 20000) {
    return { error: "query is too long" };
  }
  if (variables === undefined || variables === null || variables === "") {
    return { query, variables: {} };
  }
  let parsed = variables;
  if (typeof variables === "string") {
    try {
      parsed = JSON.parse(variables);
    } catch (e) {
      return { error: "variables must be JSON" };
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { error: "variables must be an object" };
  }
  return { query, variables: Object.assign({}, parsed) };
}

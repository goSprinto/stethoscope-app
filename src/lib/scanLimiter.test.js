import createScanLimiter, { parseScanRequest } from "./scanLimiter";

describe("scan limiter", () => {
  it("caps concurrent scans per caller", () => {
    const limiter = createScanLimiter({ maxConcurrent: 2, maxScans: 100 });
    const a = limiter.acquire("https://app.sprinto.com");
    const b = limiter.acquire("https://app.sprinto.com");
    expect(a && b).toBeTruthy();
    expect(limiter.acquire("https://app.sprinto.com")).toBe(null);
    // another caller is independent
    expect(limiter.acquire("https://eu.sprinto.com")).toBeTruthy();
    a();
    expect(limiter.acquire("https://app.sprinto.com")).toBeTruthy();
  });

  it("caps scans per time window", () => {
    let t = 0;
    const limiter = createScanLimiter({ maxScans: 3, windowMs: 1000, maxConcurrent: 10, now: () => t });
    for (let i = 0; i < 3; i++) limiter.acquire("x")();
    expect(limiter.acquire("x")).toBe(null);
    t = 1001;
    expect(limiter.acquire("x")).toBeTruthy();
  });

  it("forgets idle callers once their window has passed", () => {
    let t = 0;
    const limiter = createScanLimiter({ windowMs: 1000, now: () => t });
    limiter.acquire("https://app.sprinto.com")();
    limiter.acquire("https://eu.sprinto.com")();
    expect(limiter.size()).toBe(2);
    t = 1001;
    limiter.acquire("https://in.sprinto.com");
    expect(limiter.size()).toBe(1);
  });

  it("keeps a caller with a scan still running", () => {
    let t = 0;
    const limiter = createScanLimiter({ windowMs: 1000, now: () => t });
    limiter.acquire("busy");
    t = 5000;
    limiter.acquire("other");
    expect(limiter.size()).toBe(2);
  });

  it("ignores a second release", () => {
    const limiter = createScanLimiter({ maxConcurrent: 1, maxScans: 100 });
    const release = limiter.acquire("x");
    release();
    release();
    const again = limiter.acquire("x");
    expect(again).toBeTruthy();
    expect(limiter.acquire("x")).toBe(null);
  });
});

describe("parseScanRequest", () => {
  it.each([
    [{}, "query must be a non-empty string"],
    [{ query: "" }, "query must be a non-empty string"],
    [{ query: 42 }, "query must be a non-empty string"],
    [{ query: "x".repeat(20001) }, "query is too long"],
    [{ query: "{ a }", variables: "{not json" }, "variables must be JSON"],
    [{ query: "{ a }", variables: "[1]" }, "variables must be an object"],
    [{ query: "{ a }", variables: 5 }, "variables must be an object"],
  ])("rejects %j", (params, error) => {
    expect(parseScanRequest(params)).toEqual({ error });
  });

  it("accepts object and JSON-string variables", () => {
    expect(parseScanRequest({ query: "{ a }", variables: { x: 1 } })).toEqual({ query: "{ a }", variables: { x: 1 } });
    expect(parseScanRequest({ query: "{ a }", variables: '{"x":1}' })).toEqual({ query: "{ a }", variables: { x: 1 } });
    expect(parseScanRequest({ query: "{ a }" })).toEqual({ query: "{ a }", variables: {} });
  });
});

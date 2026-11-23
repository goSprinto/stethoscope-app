import verifyConnection from "./verifyConnection";

const httpError = (status) => Object.assign(new Error(`HTTP error ${status}`), { response: { status } });

describe("verifyConnection", () => {
  it("passes the base URL and token to the policy fetch", async () => {
    const getPolicy = jest.fn(async () => ({}));
    await expect(verifyConnection(getPolicy, "https://app.sprinto.com", "tok")).resolves.toEqual({ ok: true });
    expect(getPolicy).toHaveBeenCalledWith("https://app.sprinto.com", "tok");
  });

  it.each([401, 403])("reports a %s as a rejected token", async (status) => {
    const getPolicy = async () => { throw httpError(status); };
    await expect(verifyConnection(getPolicy, "u", "t")).resolves.toEqual({ ok: false, reason: "rejected", status });
  });

  it.each([
    ["a server error", httpError(500)],
    ["a timeout", new Error("Request timeout")],
    ["a network error", new TypeError("fetch failed")],
  ])("reports %s as unreachable", async (_, err) => {
    const getPolicy = async () => { throw err; };
    const result = await verifyConnection(getPolicy, "u", "t");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unreachable");
  });
});

import redact, { describeError } from "./redact";

describe("redact", () => {
  it.each([
    ['"Authorization": "Bearer LAB-TOKEN-6f1d2c"', "LAB-TOKEN-6f1d2c"],
    ["authorization: Bearer eyJhbGciOi.abc.def", "eyJhbGciOi.abc.def"],
    ['{"headers":{"Authorization":"Bearer abc123"}}', "abc123"],
    ['{"accessToken":"tok-123","baseUrl":"https://app.sprinto.com"}', "tok-123"],
    ["accessToken=tok-456&x=1", "tok-456"],
    ["token: tok-789", "tok-789"],
  ])("removes the token from %s", (input, secret) => {
    const out = redact(input);
    expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED]");
  });

  it("keeps the rest of the line", () => {
    expect(redact('err {"baseUrl":"https://app.sprinto.com","accessToken":"t"}')).toBe(
      'err {"baseUrl":"https://app.sprinto.com","accessToken":"[REDACTED]"}'
    );
  });

  it("leaves text without credentials alone", () => {
    const line = "2026-11-19T10:00:00Z error - services-->api:getPolicy HTTP error 500";
    expect(redact(line)).toBe(line);
  });

  it("passes non-strings through", () => {
    expect(redact(undefined)).toBe(undefined);
  });
});

describe("describeError", () => {
  it("keeps message, code and status only", () => {
    const err = new Error("HTTP error 500");
    err.code = "E500";
    err.response = { status: 500, data: { echoed: "Bearer x" } };
    err.config = { headers: { Authorization: "Bearer secret" } };
    expect(describeError(err)).toEqual({ message: "HTTP error 500", code: "E500", status: 500 });
  });
});

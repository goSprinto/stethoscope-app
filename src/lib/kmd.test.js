import kmd from "./kmd";
import { compileAndRun } from "./scripts";

jest.mock("./scripts", () => ({ compileAndRun: jest.fn() }));

describe("kmd", () => {
  beforeEach(() => compileAndRun.mockReset());

  it("runs a script once for concurrent callers sharing a context", async () => {
    let finish;
    compileAndRun.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const context = {};
    const calls = [kmd("hardware", context), kmd("hardware", context), kmd("hardware", context)];
    finish({ system: { uuid: "x" } });
    const results = await Promise.all(calls);
    expect(compileAndRun).toHaveBeenCalledTimes(1);
    results.forEach((r) => expect(r).toEqual({ system: { uuid: "x" } }));
  });

  it("keeps different variables and contexts apart", async () => {
    compileAndRun.mockResolvedValue({});
    const context = {};
    await kmd("app", context, { NAME: "a" });
    await kmd("app", context, { NAME: "b" });
    await kmd("app", {}, { NAME: "a" });
    expect(compileAndRun).toHaveBeenCalledTimes(3);
  });
});

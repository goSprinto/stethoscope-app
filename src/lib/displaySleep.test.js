import displaySleepMinutes from "./displaySleep";

const custom = (battery, ac) => `Battery Power:
 Sleep On Power Button 1
 standby              1
 displaysleep         ${battery}
 sleep                1
AC Power:
 Sleep On Power Button 1
 displaysleep         ${ac}
 disksleep            10`;

describe("displaySleepMinutes", () => {
  it("takes the longest timer across power sources", () => {
    expect(displaySleepMinutes(custom(2, 10), "2")).toBe(10);
    expect(displaySleepMinutes(custom(10, 2), "2")).toBe(10);
  });

  it("treats never (0) on any source as never", () => {
    expect(displaySleepMinutes(custom(2, 0), "2")).toBe(0);
  });

  it("handles a desktop Mac with only AC power", () => {
    expect(displaySleepMinutes("AC Power:\n displaysleep         5\n", "5")).toBe(5);
  });

  it("falls back to the active value, then -1", () => {
    expect(displaySleepMinutes(undefined, "7")).toBe(7);
    expect(displaySleepMinutes("", "-1")).toBe(-1);
    expect(displaySleepMinutes(undefined, undefined)).toBe(-1);
  });
});

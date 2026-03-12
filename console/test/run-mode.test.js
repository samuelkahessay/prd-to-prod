const {
  isSupportedRunMode,
  normalizeRunMode,
} = require("../lib/run-mode");

test("normalizeRunMode maps new to greenfield", () => {
  expect(normalizeRunMode("new")).toBe("greenfield");
});

test("normalizeRunMode leaves canonical modes unchanged", () => {
  expect(normalizeRunMode("greenfield")).toBe("greenfield");
  expect(normalizeRunMode("existing")).toBe("existing");
  expect(normalizeRunMode("auto")).toBe("auto");
});

test("isSupportedRunMode accepts UI alias and canonical modes", () => {
  expect(isSupportedRunMode("new")).toBe(true);
  expect(isSupportedRunMode("greenfield")).toBe(true);
  expect(isSupportedRunMode("existing")).toBe(true);
  expect(isSupportedRunMode("auto")).toBe(true);
  expect(isSupportedRunMode("invalid")).toBe(false);
});

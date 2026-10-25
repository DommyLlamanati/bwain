const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { themeModes } = require("../index.js");

function stylesDirWith(css) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ldm-"));
  if (css !== undefined) fs.writeFileSync(path.join(dir, "_theme.abc123.css"), css);
  return dir;
}

test("explicit settings win over detection", () => {
  const dir = stylesDirWith(".theme-dark{} .theme-light{}");
  assert.deepStrictEqual(themeModes("dark", "dark", dir), ["dark"]);
  assert.deepStrictEqual(themeModes("light", "dark", dir), ["light"]);
  assert.deepStrictEqual(themeModes("both", "dark", stylesDirWith(".theme-dark{}")), ["dark", "light"]);
});

test("the default theme (no theme file) has both modes", () => {
  assert.deepStrictEqual(themeModes("auto", "dark", stylesDirWith()), ["dark", "light"]);
  assert.deepStrictEqual(themeModes("auto", "dark", "/does/not/exist"), ["dark", "light"]);
});

test("auto detects modes from theme selectors", () => {
  assert.deepStrictEqual(themeModes("auto", "dark", stylesDirWith("body.theme-dark{} .theme-light .x{}")), ["dark", "light"]);
  assert.deepStrictEqual(themeModes("auto", "light", stylesDirWith(".theme-dark{--a:1}")), ["dark"]);
});

test("selectors in comments and longer class names do not count", () => {
  assert.deepStrictEqual(themeModes("auto", "dark", stylesDirWith("/* .theme-light */ .theme-dark{} .theme-light-ish{}")), ["dark"]);
});

test("a theme naming no mode renders in the base theme only", () => {
  assert.deepStrictEqual(themeModes("auto", "light", stylesDirWith("body{color:red}")), ["light"]);
  assert.deepStrictEqual(themeModes("auto", undefined, stylesDirWith("body{}")), ["dark"]);
});

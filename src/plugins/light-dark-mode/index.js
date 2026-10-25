const fs = require("fs");
const path = require("path");

const MODES = ["dark", "light"];

/**
 * Which modes the garden's theme can render. "auto" scans the downloaded
 * Obsidian theme (src/site/styles/_theme.*.css) for .theme-dark and
 * .theme-light selectors; the default theme (no theme file) ships both.
 * A theme that names neither mode renders only in the base theme.
 */
function themeModes(setting, baseTheme, stylesDir) {
  if (setting === "both") return [...MODES];
  if (MODES.includes(setting)) return [setting];

  let file;
  try {
    file = fs.readdirSync(stylesDir).find((f) => /^_theme\..*\.css$/.test(f));
  } catch {
    return [...MODES];
  }
  if (!file) return [...MODES];

  let css = "";
  try {
    css = fs.readFileSync(path.join(stylesDir, file), "utf8");
  } catch {}
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = MODES.filter((m) => new RegExp(`\\.theme-${m}(?![\\w-])`).test(css));
  return found.length > 0 ? found : [baseTheme === "light" ? "light" : "dark"];
}

module.exports = {
  themeModes,
  setupEleventy(eleventyConfig) {
    const stylesDir = path.join(process.cwd(), "src", "site", "styles");
    eleventyConfig.addFilter("lightDarkModes", (setting, baseTheme) =>
      themeModes(setting, baseTheme, stylesDir),
    );
  },
};

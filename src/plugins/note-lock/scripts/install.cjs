const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
if (!process.argv[2]) throw new Error("Usage: npm run install:garden -- /path/to/garden");
const garden = path.resolve(process.argv[2]);
if (!fs.existsSync(path.join(garden, "src/helpers/pluginLoader.js"))) throw new Error("Target must support garden plugins.");
const target = path.join(garden, "src/plugins/note-lock");
fs.mkdirSync(target, { recursive: true });
for (const entry of ["garden-plugin.json", "index.js", "assets", "styles", "templates"]) {
  fs.cpSync(path.join(root, entry), path.join(target, entry), { recursive: true });
}
console.log(`Installed Note Lock into ${target}. Existing settings were preserved.`);

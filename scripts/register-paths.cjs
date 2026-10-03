// Keep module aliases inside this checkout, including with shared node_modules.
const path = require("node:path");
const moduleAlias = require("module-alias");
const root = path.resolve(__dirname, "..");
const aliases = require("../package.json")._moduleAliases;
for (const [alias, target] of Object.entries(aliases)) {
    moduleAlias.addAlias(alias, path.resolve(root, target));
}

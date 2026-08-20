const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const serverRoot = path.resolve(__dirname, "..");
const excludedDirectories = new Set(["coverage", "node_modules"]);

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name) ? [] : collectJavaScriptFiles(entryPath);
    }

    return entry.isFile() && [".js", ".mjs"].includes(path.extname(entry.name)) ? [entryPath] : [];
  });
}

const files = collectJavaScriptFiles(serverRoot).sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Syntax check passed for ${files.length} server and test files.`);

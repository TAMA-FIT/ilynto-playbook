import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const MCP_TEMPLATE = path.join(HERE, "mcp");
const SEMANTIC_BATCH = path.join(REPO_ROOT, "references", "orchestration", "semantic-batch.mjs");
const DEPLOYMENT_IDENTITY = path.join(REPO_ROOT, "references", "gpt-pc-bridge", "deployment-identity.mjs");

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

export function buildRuntime(targetDir) {
  const target = path.resolve(String(targetDir || "").trim());
  if (!targetDir) throw new Error("TARGET_DIR_REQUIRED");
  if (target === REPO_ROOT || target.startsWith(REPO_ROOT + path.sep)) {
    throw new Error("TARGET_MUST_BE_OUTSIDE_PLAYBOOK_REPOSITORY");
  }

  fs.mkdirSync(path.join(target, "lib"), { recursive: true });

  const sourceServer = fs.readFileSync(path.join(MCP_TEMPLATE, "server.mjs"), "utf8");
  const rewrittenServer = sourceServer.replace(
    '../../../references/orchestration/semantic-batch.mjs',
    './lib/semantic-batch.mjs',
  );
  if (rewrittenServer === sourceServer) {
    throw new Error("SEMANTIC_BATCH_IMPORT_REWRITE_FAILED");
  }

  fs.writeFileSync(path.join(target, "server.mjs"), rewrittenServer, "utf8");
  copyFile(path.join(MCP_TEMPLATE, "lib", "ops.mjs"), path.join(target, "lib", "ops.mjs"));
  copyFile(SEMANTIC_BATCH, path.join(target, "lib", "semantic-batch.mjs"));
  copyFile(DEPLOYMENT_IDENTITY, path.join(target, "lib", "deployment-identity.mjs"));
  copyFile(path.join(MCP_TEMPLATE, "package.json"), path.join(target, "package.json"));
  copyFile(path.join(MCP_TEMPLATE, "package-lock.json"), path.join(target, "package-lock.json"));

  const manifest = {
    schemaVersion: 1,
    recipeId: "gpt-pc-bridge.windows",
    entrypoint: "server.mjs",
    packageManager: "npm",
    installCommand: "npm ci --ignore-scripts",
    startCommand: "node server.mjs",
    generatedFrom: {
      template: "templates/gpt-pc-bridge/mcp",
      orchestration: "references/orchestration/semantic-batch.mjs",
      deploymentIdentity: "references/gpt-pc-bridge/deployment-identity.mjs",
    },
  };
  fs.writeFileSync(path.join(target, "runtime-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return {
    ok: true,
    target,
    files: [
      "server.mjs",
      "lib/ops.mjs",
      "lib/semantic-batch.mjs",
      "lib/deployment-identity.mjs",
      "package.json",
      "package-lock.json",
      "runtime-manifest.json",
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  try {
    console.log(JSON.stringify(buildRuntime(target), null, 2));
  } catch (error) {
    console.error(String(error?.stack || error));
    process.exit(1);
  }
}

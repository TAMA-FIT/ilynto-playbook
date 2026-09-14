import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildRuntime } from "../templates/gpt-pc-bridge/build-runtime.mjs";

test("standalone runtime builder emits a self-contained runtime tree", (t) => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "ilynto-runtime-build-"));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));

  const result = buildRuntime(target);
  assert.equal(result.ok, true);

  for (const relative of [
    "server.mjs",
    "lib/ops.mjs",
    "lib/semantic-batch.mjs",
    "lib/deployment-identity.mjs",
    "package.json",
    "package-lock.json",
    "runtime-manifest.json",
  ]) {
    assert.equal(fs.existsSync(path.join(target, relative)), true, `missing ${relative}`);
  }

  const server = fs.readFileSync(path.join(target, "server.mjs"), "utf8");
  assert.match(server, /\.\/lib\/semantic-batch\.mjs/);
  assert.doesNotMatch(server, /\.\.\/\.\.\/\.\.\/references\/orchestration/);

  const manifest = JSON.parse(fs.readFileSync(path.join(target, "runtime-manifest.json"), "utf8"));
  assert.equal(manifest.recipeId, "gpt-pc-bridge.windows");
  assert.equal(manifest.startCommand, "node server.mjs");
});

test("standalone runtime builder refuses to overwrite inside the public playbook", () => {
  assert.throws(
    () => buildRuntime(path.resolve("templates/gpt-pc-bridge/generated-here")),
    /TARGET_MUST_BE_OUTSIDE_PLAYBOOK_REPOSITORY/,
  );
});

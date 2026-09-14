import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import {
  assertCommandAllowed,
  assertPathAllowed,
  fsDelete,
  fsRead,
  fsWrite,
  isProtectedSecretPath,
  isProtectedWritePath,
  sanitizeEnv,
} from "../templates/gpt-pc-bridge/mcp/lib/ops.mjs";

const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ilynto-bridge-test-"));

test.after(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
});

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("fenced file replacement accepts current SHA and returns new SHA", () => {
  const target = path.join(scratchRoot, "fenced.txt");
  fs.writeFileSync(target, "before", "utf8");
  const beforeSha = sha(Buffer.from("before"));
  const result = fsWrite({ path: target, mode: "replace", content: "after", expectedSha256: beforeSha });
  assert.equal(result.ok, true);
  assert.equal(result.sha256, sha(Buffer.from("after")));
  assert.equal(fs.readFileSync(target, "utf8"), "after");
});

test("fenced file replacement rejects stale SHA before mutation", () => {
  const target = path.join(scratchRoot, "stale.txt");
  fs.writeFileSync(target, "current", "utf8");
  assert.throws(
    () => fsWrite({ path: target, mode: "replace", content: "wrong", expectedSha256: "0".repeat(64) }),
    /STALE_SHA:/,
  );
  assert.equal(fs.readFileSync(target, "utf8"), "current");
});

test("delete with stale SHA is rejected", () => {
  const target = path.join(scratchRoot, "delete-stale.txt");
  fs.writeFileSync(target, "keep", "utf8");
  assert.throws(() => fsDelete({ path: target, expectedSha256: "f".repeat(64) }), /STALE_SHA:/);
  assert.equal(fs.existsSync(target), true);
});

test("ordinary scratch file remains readable", () => {
  const target = path.join(scratchRoot, "normal.txt");
  fs.writeFileSync(target, "ok", "utf8");
  const result = fsRead({ path: target, includeSha256: true });
  assert.equal(result.content, "ok");
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test("secret-looking .env path is denied while template form is allowed", () => {
  const secret = path.join(scratchRoot, ".env");
  const example = path.join(scratchRoot, ".env.example");
  assert.equal(isProtectedSecretPath(secret), true);
  assert.equal(isProtectedSecretPath(example), false);
  assert.throws(() => assertPathAllowed(secret, "read"), /SECURITY_SECRET_PATH_DENIED/);
  assert.equal(assertPathAllowed(example, "read"), path.resolve(example));
});

test("SSH private-key path is denied", () => {
  const target = path.join(scratchRoot, ".ssh", "id_ed25519");
  assert.equal(isProtectedSecretPath(target), true);
  assert.throws(() => assertPathAllowed(target, "read"), /SECURITY_SECRET_PATH_DENIED/);
});

test("configured control root is protected from generic writes", () => {
  const control = path.join(scratchRoot, "control");
  const target = path.join(control, "server.mjs");
  assert.equal(isProtectedWritePath(target, control), true);
});

test("template control root is protected by default", () => {
  const target = path.resolve("templates/gpt-pc-bridge/mcp/server.mjs");
  assert.equal(isProtectedWritePath(target), true);
  assert.throws(() => assertPathAllowed(target, "write"), /SECURITY_PROTECTED_WRITE_DENIED/);
});

test("exceptional persistence command is denied", () => {
  assert.throws(
    () => assertCommandAllowed('schtasks /Create /TN "x" /TR "cmd /c echo hi" /SC ONLOGON'),
    /SECURITY_EXCEPTIONAL_BOUNDARY_REQUIRED:scheduled_task_mutation/,
  );
});

test("ordinary development command remains allowed", () => {
  assert.equal(assertCommandAllowed("git status --short"), true);
  assert.equal(assertCommandAllowed("npm test"), true);
});

test("secret-looking env keys cannot be transported through generic tool args", () => {
  assert.throws(() => sanitizeEnv({ API_KEY: "example-not-a-real-secret" }), /SECURITY_SECRET_ENV_TRANSPORT_DENIED/);
  const env = sanitizeEnv({ ILYNTO_TEST_FLAG: "1" });
  assert.equal(env.ILYNTO_TEST_FLAG, "1");
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(ROOT, "templates", "gpt-pc-bridge", "mcp");
const SERVER = path.join(TEMPLATE, "server.mjs");

function createRpcClient() {
  const child = spawn(process.execPath, [SERVER], {
    cwd: TEMPLATE,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdoutBuffer = "";
  let stderr = "";
  let nextId = 1;
  const pending = new Map();

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    while (true) {
      const newline = stdoutBuffer.indexOf("\n");
      if (newline < 0) break;
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); }
      catch (error) {
        for (const { reject } of pending.values()) reject(new Error(`Invalid JSON from MCP: ${line}\n${error}`));
        pending.clear();
        continue;
      }
      if (message.id !== undefined && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
        else waiter.resolve(message.result);
      }
    }
  });

  function sendRaw(message) {
    child.stdin.write(JSON.stringify(message) + "\n");
  }

  function request(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}\nstderr=${stderr}`));
      }, 10_000);
      pending.set(id, {
        resolve(value) { clearTimeout(timer); resolve(value); },
        reject(error) { clearTimeout(timer); reject(error); },
      });
      sendRaw({ jsonrpc: "2.0", id, method, params });
    });
  }

  async function initialize() {
    const result = await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "ilynto-playbook-test", version: "0.1.0" },
    });
    sendRaw({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    return result;
  }

  function close() {
    try { child.stdin.end(); } catch {}
    try { child.kill(); } catch {}
  }

  return { child, request, initialize, close, stderr: () => stderr };
}

function structured(result) {
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find?.((entry) => entry.type === "text")?.text;
  return text ? JSON.parse(text) : null;
}

test("portable stdio MCP discovers tools and completes scratch read/write/batch E2E", async (t) => {
  const client = createRpcClient();
  t.after(() => client.close());

  const initialized = await client.initialize();
  assert.ok(initialized?.serverInfo?.name);

  const tools = await client.request("tools/list", {});
  const names = new Set((tools.tools || []).map((tool) => tool.name));
  for (const expected of [
    "system.status",
    "runtime.info",
    "fs.stat",
    "fs.read",
    "fs.write",
    "shell.run",
    "git.status",
    "semantic.batch",
  ]) {
    assert.ok(names.has(expected), `missing tool ${expected}`);
  }

  const statusResult = await client.request("tools/call", {
    name: "system.status",
    arguments: {},
  });
  const status = structured(statusResult);
  assert.equal(status.ok, true);
  assert.equal(status.transport, "stdio");
  assert.equal(status.authority, "current-user");
  assert.equal(status.securityBoundary.publicListener, false);

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ilynto-gpt-pc-bridge-"));
  const file = path.join(scratch, "roundtrip.txt");
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));

  const batchResult = await client.request("tools/call", {
    name: "semantic.batch",
    arguments: {
      semanticStep: "change_verify",
      tag: "clean-room-test",
      operations: [
        {
          id: "write",
          kind: "fs.write",
          role: "change",
          capture: "compact",
          args: {
            path: file,
            mode: "create",
            content: "hello from gpt-pc bridge",
            createParents: true,
          },
        },
        {
          id: "verify",
          kind: "fs.read",
          role: "verify",
          capture: "full",
          args: { path: file, includeSha256: true },
        },
      ],
    },
  });
  const batch = structured(batchResult);
  assert.equal(batch.ok, true);
  assert.equal(batch.semanticStep, "change_verify");
  assert.equal(batch.outerCallCompression.semanticOuterCalls, 1);
  assert.equal(batch.outerCallCompression.nestedLocalOperations, 2);
  assert.deepEqual(batch.evidence.map((entry) => entry.role), ["change", "verify"]);

  const verifyEntry = batch.results.find((entry) => entry.id === "verify");
  assert.equal(verifyEntry.result.content, "hello from gpt-pc bridge");
  assert.match(verifyEntry.result.sha256, /^[a-f0-9]{64}$/);

  const deleteResult = await client.request("tools/call", {
    name: "fs.delete",
    arguments: { path: file },
  });
  assert.equal(structured(deleteResult).ok, true);

  const finalStatResult = await client.request("tools/call", {
    name: "fs.stat",
    arguments: { path: file },
  });
  assert.equal(structured(finalStatResult).exists, false);
});

test("portable MCP protects secret-shaped files and its own runtime files", async (t) => {
  const client = createRpcClient();
  t.after(() => client.close());
  await client.initialize();

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ilynto-gpt-pc-security-"));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const envPath = path.join(scratch, ".env");
  fs.writeFileSync(envPath, "FAKE_TOKEN=not-a-real-secret\n", "utf8");

  const deniedRead = await client.request("tools/call", {
    name: "fs.read",
    arguments: { path: envPath },
  });
  assert.equal(deniedRead.isError, true);
  assert.match(deniedRead.content?.[0]?.text || "", /SECURITY_SECRET_PATH_DENIED/);

  const deniedSelfWrite = await client.request("tools/call", {
    name: "fs.write",
    arguments: {
      path: SERVER,
      mode: "replace",
      content: "should not write",
    },
  });
  assert.equal(deniedSelfWrite.isError, true);
  assert.match(deniedSelfWrite.content?.[0]?.text || "", /SECURITY_PROTECTED_WRITE_DENIED/);
});

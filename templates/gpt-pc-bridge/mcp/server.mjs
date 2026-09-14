import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { createSemanticBatchEngine } from "../../../references/orchestration/semantic-batch.mjs";
import { dispatchOperation } from "./lib/ops.mjs";

const VERSION = "0.1.0";
const SERVER_NAME = "ILYNTO GPT-PC Bridge";

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const destructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

const externalAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

function toolResult(data) {
  return {
    structuredContent: data,
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function makeServer() {
  const server = new McpServer(
    { name: SERVER_NAME, version: VERSION },
    {
      instructions: [
        "This MCP exposes bounded Windows filesystem, shell, process, Git and runtime capabilities.",
        "Use ordinary typed tools for small operations, but prefer semantic.batch when multiple deterministic local operations can remain inside one semantic step.",
        "After mutation, verify the requested postcondition before claiming completion.",
        "Respect stale SHA/Git fences. Do not bypass SECURITY_* denials; treat exceptional/admin/security/persistence work as a Human Boundary.",
        "This bridge is not a cryptographic sandbox. Generic current-user shell authority remains powerful.",
      ].join(" "),
    },
  );

  const register = (name, description, inputSchema, annotations, handler = dispatchOperation) => {
    server.registerTool(
      name,
      { title: name, description, inputSchema, annotations },
      async (input) => toolResult(await handler(name, input)),
    );
  };

  register(
    "system.status",
    "Return bridge version, platform and security-contract summary.",
    z.object({}),
    readAnnotations,
  );

  register(
    "runtime.info",
    "Probe local Node.js, npm, Python, Git and PowerShell availability/versions.",
    z.object({}),
    readAnnotations,
  );

  register(
    "fs.stat",
    "Stat a file/directory. Optionally include SHA-256 for files.",
    z.object({ path: z.string().min(1), includeSha256: z.boolean().optional() }),
    readAnnotations,
  );

  register(
    "fs.list",
    "List one directory with bounded output.",
    z.object({ path: z.string().min(1), limit: z.number().int().min(1).max(5000).optional() }),
    readAnnotations,
  );

  register(
    "fs.read",
    "Read a bounded file range. Protected credential/secret paths are denied.",
    z.object({
      path: z.string().min(1),
      offset: z.number().int().nonnegative().optional(),
      maxBytes: z.number().int().min(1).max(2 * 1024 * 1024).optional(),
      encoding: z.string().optional(),
      includeSha256: z.boolean().optional(),
    }),
    readAnnotations,
  );

  register(
    "fs.search",
    "Recursively search text files with bounded file/result limits while skipping protected secret paths.",
    z.object({
      path: z.string().min(1),
      query: z.string().min(1),
      caseSensitive: z.boolean().optional(),
      maxResults: z.number().int().min(1).max(1000).optional(),
      maxFiles: z.number().int().min(1).max(50000).optional(),
      maxFileBytes: z.number().int().min(1).max(2 * 1024 * 1024).optional(),
    }),
    readAnnotations,
  );

  register(
    "fs.write",
    "Create/replace/append a text file. expectedSha256 provides an optimistic stale-write fence. Protected secret/persistence/control paths are denied.",
    z.object({
      path: z.string().min(1),
      mode: z.enum(["create", "replace", "append"]),
      content: z.string(),
      encoding: z.string().optional(),
      expectedSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
      createParents: z.boolean().optional(),
    }),
    writeAnnotations,
  );

  register(
    "fs.mkdir",
    "Create a directory. Protected write paths are denied.",
    z.object({ path: z.string().min(1), recursive: z.boolean().optional() }),
    writeAnnotations,
  );

  register(
    "fs.delete",
    "Delete a file/directory. File deletion may be fenced with expectedSha256. Protected paths are denied.",
    z.object({
      path: z.string().min(1),
      recursive: z.boolean().optional(),
      force: z.boolean().optional(),
      expectedSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
    }),
    destructiveAnnotations,
  );

  register(
    "fs.move",
    "Move a file/directory with optional source SHA fence and overwrite flag.",
    z.object({
      source: z.string().min(1),
      destination: z.string().min(1),
      overwrite: z.boolean().optional(),
      createParents: z.boolean().optional(),
      expectedSourceSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
    }),
    destructiveAnnotations,
  );

  register(
    "fs.copy",
    "Copy a file/directory with optional source SHA fence.",
    z.object({
      source: z.string().min(1),
      destination: z.string().min(1),
      recursive: z.boolean().optional(),
      overwrite: z.boolean().optional(),
      createParents: z.boolean().optional(),
      expectedSourceSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
    }),
    writeAnnotations,
  );

  const processCommon = {
    cwd: z.string().optional(),
    env: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    timeoutMs: z.number().int().min(1000).max(300000).optional(),
    maxOutputBytes: z.number().int().min(4096).max(2 * 1024 * 1024).optional(),
  };

  register(
    "shell.run",
    "Run PowerShell or cmd under the current Windows user with bounded output/time. Exceptional security/admin/persistence command classes are denied for Human Boundary handling.",
    z.object({
      shell: z.enum(["powershell", "pwsh", "cmd"]).optional(),
      command: z.string().min(1),
      ...processCommon,
    }),
    destructiveAnnotations,
  );

  register(
    "exec.run",
    "Run an executable with argv under the current Windows user with bounded output/time.",
    z.object({
      executable: z.string().min(1),
      args: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
      ...processCommon,
    }),
    destructiveAnnotations,
  );

  register(
    "process.list",
    "List Windows processes with optional text filter.",
    z.object({
      filter: z.string().optional(),
      limit: z.number().int().min(1).max(5000).optional(),
      timeoutMs: z.number().int().min(1000).max(300000).optional(),
    }),
    readAnnotations,
  );

  register(
    "process.start",
    "Start a current-user process, optionally redirecting stdout/stderr to allowed files.",
    z.object({
      executable: z.string().min(1),
      args: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
      cwd: z.string().optional(),
      env: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      detached: z.boolean().optional(),
      stdoutPath: z.string().optional(),
      stderrPath: z.string().optional(),
      appendOutput: z.boolean().optional(),
    }),
    destructiveAnnotations,
  );

  register(
    "process.stop",
    "Stop a Windows process tree by PID.",
    z.object({
      pid: z.number().int().positive(),
      force: z.boolean().optional(),
      timeoutMs: z.number().int().min(1000).max(300000).optional(),
    }),
    destructiveAnnotations,
  );

  const gitCommon = {
    timeoutMs: z.number().int().min(1000).max(300000).optional(),
    maxOutputBytes: z.number().int().min(4096).max(2 * 1024 * 1024).optional(),
  };

  register(
    "git.status",
    "Return Git short branch/status for a repository.",
    z.object({ repo: z.string().min(1), ...gitCommon }),
    readAnnotations,
  );

  register(
    "git.diff",
    "Return Git diff for a repository, optionally staged and path-scoped.",
    z.object({
      repo: z.string().min(1),
      staged: z.boolean().optional(),
      paths: z.array(z.string()).optional(),
      ...gitCommon,
    }),
    readAnnotations,
  );

  register(
    "git.stage",
    "Stage selected paths or all changes in a repository.",
    z.object({
      repo: z.string().min(1),
      paths: z.array(z.string()).optional(),
      all: z.boolean().optional(),
      ...gitCommon,
    }),
    writeAnnotations,
  );

  register(
    "git.commit",
    "Create a Git commit. expectedHead can fence the commit against a stale base revision.",
    z.object({
      repo: z.string().min(1),
      message: z.string().min(1),
      paths: z.array(z.string()).optional(),
      stageAll: z.boolean().optional(),
      expectedHead: z.string().regex(/^[a-fA-F0-9]{40}$/).optional(),
      authorName: z.string().optional(),
      authorEmail: z.string().optional(),
      noVerify: z.boolean().optional(),
      ...gitCommon,
    }),
    writeAnnotations,
  );

  register(
    "git.remote",
    "Clone/fetch/pull/push using the Git credentials already available to the current user. Do not pass secrets in URLs or tool arguments.",
    z.object({
      action: z.enum(["clone", "fetch", "pull", "push"]),
      repo: z.string().optional(),
      url: z.string().optional(),
      destination: z.string().optional(),
      cwd: z.string().optional(),
      remote: z.string().optional(),
      ref: z.string().optional(),
      depth: z.number().int().positive().optional(),
      setUpstream: z.boolean().optional(),
      ...gitCommon,
    }),
    externalAnnotations,
  );

  const semanticEngine = createSemanticBatchEngine({
    dispatch: dispatchOperation,
    readOnlyKinds: new Set([
      "system.status",
      "runtime.info",
      "fs.stat",
      "fs.list",
      "fs.read",
      "fs.search",
      "process.list",
      "git.status",
      "git.diff",
    ]),
    verifyDeniedKinds: new Set([
      "fs.write",
      "fs.mkdir",
      "fs.delete",
      "fs.move",
      "fs.copy",
      "process.start",
      "process.stop",
      "git.stage",
      "git.commit",
      "git.remote",
    ]),
    autoParallelKinds: new Set([
      "system.status",
      "runtime.info",
      "fs.stat",
      "fs.list",
      "fs.read",
      "fs.search",
      "process.list",
      "git.status",
      "git.diff",
    ]),
    explicitParallelKinds: new Set(["shell.run", "exec.run"]),
    telemetry: async (event) => {
      // STDERR only: stdout belongs to MCP stdio protocol.
      if (process.env.GPT_PC_BRIDGE_TELEMETRY === "1") {
        console.error(JSON.stringify({ at: new Date().toISOString(), ...event }));
      }
    },
  });

  server.registerTool(
    "semantic.batch",
    {
      title: "Semantic Batch",
      description: "Execute one bounded semantic step as a DAG of local operations. Use inspect, change_verify, or finalize. Mutation/finalization requires verification and verification is ordered after all mutations.",
      inputSchema: z.object({
        semanticStep: z.enum(["inspect", "change_verify", "finalize"]),
        tag: z.string().max(80).optional(),
        concurrency: z.number().int().min(1).max(16).optional(),
        operations: z.array(z.object({
          id: z.string().max(80).optional(),
          kind: z.string().min(1),
          role: z.enum(["inspect", "change", "finalize", "verify"]).optional(),
          args: z.record(z.string(), z.any()).optional(),
          dependsOn: z.array(z.string()).optional(),
          parallel: z.boolean().optional(),
          capture: z.enum(["none", "compact", "full"]).optional(),
        })).min(1).max(64),
      }),
      annotations: destructiveAnnotations,
    },
    async (input) => toolResult(await semanticEngine.runSemanticStep(input)),
  );

  return server;
}

const handle = serveStdio(makeServer, {
  onerror(error) {
    console.error(`[${SERVER_NAME}] ${String(error?.stack || error?.message || error)}`);
  },
});

const shutdown = async () => {
  try { await handle.close(); } catch {}
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

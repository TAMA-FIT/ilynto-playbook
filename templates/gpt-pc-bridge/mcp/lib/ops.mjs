import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_OUTPUT_BYTES = 128 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_READ_BYTES = 2 * 1024 * 1024;
const MAX_WRITE_BYTES = 2 * 1024 * 1024;
const DEFAULT_CONTROL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SECRET_FIELD_RE = /secret|token|password|credential|authorization|cookie|api.?key|private.?key/i;
const PRIVATE_KEY_NAME_RE = /(^|[._-])(id_(rsa|dsa|ecdsa|ed25519)|private.?key|client_secret|credentials|application_default_credentials)([._-]|$)/i;
const SECRET_FILE_NAME_RE = /^(\.env(?:\..+)?|credentials\.json|application_default_credentials\.json|client_secret.*\.json)$/i;
const SECRET_FILE_ALLOW_RE = /^\.env\.(example|sample|template)$/i;
const PRIVATE_BUNDLE_RE = /\.(pfx|p12|pem|key)$/i;

function normalizeForCompare(value) {
  return path.resolve(String(value)).replaceAll("/", "\\").toLowerCase();
}

function existingCanonicalPath(target) {
  let current = path.resolve(target);
  const suffix = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    suffix.unshift(path.basename(current));
    current = parent;
  }
  try {
    current = fs.realpathSync.native(current);
  } catch {}
  return path.join(current, ...suffix);
}

function pathSegments(target) {
  return normalizeForCompare(existingCanonicalPath(target)).split("\\").filter(Boolean);
}

function fileName(target) {
  return path.basename(target).toLowerCase();
}

export function isProtectedSecretPath(target) {
  const resolved = normalizeForCompare(existingCanonicalPath(target));
  const segments = pathSegments(target);
  const name = fileName(target);

  if (SECRET_FILE_ALLOW_RE.test(name)) return false;
  if (SECRET_FILE_NAME_RE.test(name)) return true;
  if (PRIVATE_KEY_NAME_RE.test(name) || PRIVATE_BUNDLE_RE.test(name)) return true;

  const protectedSegments = new Set([
    ".ssh",
    ".aws",
    ".azure",
    ".gnupg",
    ".kube",
    "credentials",
  ]);
  if (segments.some((segment) => protectedSegments.has(segment))) return true;

  if (resolved.includes("\\google\\cloud sdk\\") && resolved.includes("credential")) return true;
  if (resolved.includes("\\gcloud\\") && resolved.includes("credential")) return true;
  if (resolved.includes("\\microsoft\\credentials\\")) return true;
  if (resolved.includes("\\microsoft\\protect\\")) return true;
  if (resolved.includes("\\credentialmanager\\")) return true;
  if (resolved.includes("\\chrome\\user data\\") && /(login data|cookies|web data)$/i.test(name)) return true;
  if (resolved.includes("\\edge\\user data\\") && /(login data|cookies|web data)$/i.test(name)) return true;
  if (resolved.includes("\\firefox\\profiles\\") && /(logins\.json|key4\.db|cookies\.sqlite)$/i.test(name)) return true;
  if (resolved.includes("\\tunnel-client\\") && /key|credential|secret/i.test(name)) return true;

  return false;
}

export function isProtectedWritePath(target, controlRoot = process.env.GPT_PC_BRIDGE_CONTROL_ROOT || DEFAULT_CONTROL_ROOT) {
  const resolved = normalizeForCompare(existingCanonicalPath(target));
  if (isProtectedSecretPath(target)) return true;

  if (controlRoot) {
    const root = normalizeForCompare(existingCanonicalPath(controlRoot));
    if (resolved === root || resolved.startsWith(root + "\\")) return true;
  }

  if (resolved.includes("\\.git\\hooks\\")) return true;
  if (/\\\.git\\config(?:\.worktree)?$/i.test(resolved)) return true;
  if (resolved.includes("\\microsoft\\windows\\start menu\\programs\\startup\\")) return true;
  if (resolved.includes("\\programdata\\microsoft\\windows\\start menu\\programs\\startup\\")) return true;
  if (resolved.includes("\\windows\\system32\\tasks\\")) return true;
  if (/\\windows\\system32\\drivers\\etc\\hosts$/i.test(resolved)) return true;
  if (/\\documents\\(?:windows)?powershell\\.*profile.*\.ps1$/i.test(resolved)) return true;

  return false;
}

export function assertPathAllowed(target, operation = "read") {
  const resolved = path.resolve(String(target));
  if (isProtectedSecretPath(resolved)) {
    throw new Error(`SECURITY_SECRET_PATH_DENIED:${resolved}`);
  }
  if (operation !== "read" && isProtectedWritePath(resolved)) {
    throw new Error(`SECURITY_PROTECTED_WRITE_DENIED:${resolved}`);
  }
  return resolved;
}

function exceptionalCommandReason(command) {
  const text = String(command || "").toLowerCase();
  const checks = [
    [/powershell(?:\.exe)?[^\r\n]*(?:-enc|-encodedcommand)\b/, "encoded_powershell"],
    [/\bschtasks(?:\.exe)?\b[^\r\n]*\/(?:create|change|delete|run)\b/i, "scheduled_task_mutation"],
    [/\bsc(?:\.exe)?\s+(?:create|config|delete|start|stop)\b/i, "service_mutation"],
    [/\bnetsh\b[^\r\n]*\badvfirewall\b/i, "firewall_mutation"],
    [/\bset-mppreference\b|\badd-mppreference\b|\bremove-mppreference\b/i, "defender_mutation"],
    [/\breg(?:\.exe)?\s+(?:add|delete|import|copy|restore|load|unload)\b/i, "registry_mutation"],
    [/\b(?:regsvr32|rundll32|mshta)\b/i, "lolbin_execution"],
    [/\b(?:mimikatz|sekurlsa|lsadump|procdump)\b/i, "credential_access"],
    [/\bshutdown(?:\.exe)?\b[^\r\n]*(?:\/r|\/s|-r|-s)\b/i, "host_shutdown_restart"],
    [/\bgit\s+config\b[^\r\n]*(?:core\.hookspath|credential\.helper|core\.sshcommand|filter\.[^\s]+\.(?:clean|smudge|process)|include\.(?:path|if)|url\.[^\s]+\.insteadof)/i, "dangerous_git_config"],
    [/(?:invoke-webrequest|curl(?:\.exe)?|wget)[^\r\n|;&]*(?:\||;)\s*(?:powershell|pwsh|cmd|python|node)\b/i, "download_to_interpreter"],
  ];
  for (const [regex, reason] of checks) if (regex.test(text)) return reason;
  return null;
}

export function assertCommandAllowed(command) {
  const reason = exceptionalCommandReason(command);
  if (reason) throw new Error(`SECURITY_EXCEPTIONAL_BOUNDARY_REQUIRED:${reason}`);

  const lower = String(command || "").toLowerCase();
  for (const marker of ["\\.ssh\\", "\\.aws\\", "\\.env", "credentials.json", "client_secret", "application_default_credentials", "login data", "key4.db"]) {
    if (lower.includes(marker)) throw new Error("SECURITY_CREDENTIAL_REFERENCE_DENIED");
  }
  return true;
}

export function sanitizeEnv(extra = {}) {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return { ...process.env };
  const env = { ...process.env };
  for (const [key, value] of Object.entries(extra)) {
    if (SECRET_FIELD_RE.test(key)) {
      throw new Error(`SECURITY_SECRET_ENV_TRANSPORT_DENIED:${key}`);
    }
    if (value === null || value === undefined) delete env[key];
    else env[key] = String(value);
  }
  return env;
}

export function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.trunc(parsed), max));
}

function runProcess(executable, args = [], options = {}) {
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, MAX_TIMEOUT_MS);
  const maxOutputBytes = boundedInteger(options.maxOutputBytes, DEFAULT_OUTPUT_BYTES, 4096, MAX_OUTPUT_BYTES);
  const cwd = options.cwd ? assertPathAllowed(options.cwd, "read") : process.cwd();
  const env = sanitizeEnv(options.env);
  const requestedExecutable = String(executable);
  const requestedArgs = Array.isArray(args) ? args.map(String) : [];
  assertCommandAllowed([requestedExecutable, ...requestedArgs].join(" "));

  const commandIsBatch = /\.(cmd|bat)$/i.test(requestedExecutable);
  const launchExecutable = commandIsBatch ? (process.env.COMSPEC || "cmd.exe") : requestedExecutable;
  const launchArgs = commandIsBatch ? ["/d", "/s", "/c", requestedExecutable, ...requestedArgs] : requestedArgs;

  const result = spawnSync(launchExecutable, launchArgs, {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: maxOutputBytes,
  });

  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || "");
  return {
    ok: !result.error && result.status === 0,
    executable: requestedExecutable,
    args: requestedArgs,
    cwd,
    exitCode: Number.isInteger(result.status) ? result.status : null,
    signal: result.signal || null,
    timedOut: result.error?.code === "ETIMEDOUT",
    stdout: Buffer.byteLength(stdout, "utf8") > maxOutputBytes ? stdout.slice(0, maxOutputBytes) : stdout,
    stderr: Buffer.byteLength(stderr, "utf8") > maxOutputBytes ? stderr.slice(0, maxOutputBytes) : stderr,
    error: result.error ? String(result.error.message || result.error) : null,
  };
}

export function fsStat(args = {}) {
  const target = assertPathAllowed(args.path, "read");
  if (!fs.existsSync(target)) return { ok: true, path: target, exists: false };
  const stat = fs.lstatSync(target);
  return {
    ok: true,
    path: target,
    exists: true,
    type: stat.isFile() ? "file" : stat.isDirectory() ? "directory" : "other",
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    createdAt: stat.birthtime.toISOString(),
    sha256: args.includeSha256 && stat.isFile() ? sha256File(target) : undefined,
  };
}

export function fsList(args = {}) {
  const target = assertPathAllowed(args.path, "read");
  const limit = boundedInteger(args.limit, 500, 1, 5000);
  const entries = fs.readdirSync(target, { withFileTypes: true }).slice(0, limit).map((entry) => ({
    name: entry.name,
    type: entry.isFile() ? "file" : entry.isDirectory() ? "directory" : "other",
  }));
  return { ok: true, path: target, entries, truncated: entries.length >= limit };
}

export function fsRead(args = {}) {
  const target = assertPathAllowed(args.path, "read");
  const offset = boundedInteger(args.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const maxBytes = boundedInteger(args.maxBytes, 128 * 1024, 1, MAX_READ_BYTES);
  const encoding = String(args.encoding || "utf8");
  const handle = fs.openSync(target, "r");
  try {
    const stat = fs.fstatSync(handle);
    const length = Math.max(0, Math.min(maxBytes, stat.size - offset));
    const buffer = Buffer.alloc(length);
    const bytesRead = length ? fs.readSync(handle, buffer, 0, length, offset) : 0;
    return {
      ok: true,
      path: target,
      totalBytes: stat.size,
      offset,
      bytesRead,
      eof: offset + bytesRead >= stat.size,
      encoding,
      content: buffer.subarray(0, bytesRead).toString(encoding),
      sha256: args.includeSha256 ? sha256File(target) : undefined,
    };
  } finally {
    fs.closeSync(handle);
  }
}

export function fsSearch(args = {}) {
  const root = assertPathAllowed(args.path, "read");
  const query = String(args.query ?? "");
  if (!query) throw new Error("FS_SEARCH_QUERY_REQUIRED");
  const caseSensitive = args.caseSensitive === true;
  const needle = caseSensitive ? query : query.toLowerCase();
  const maxResults = boundedInteger(args.maxResults, 100, 1, 1000);
  const maxFiles = boundedInteger(args.maxFiles, 5000, 1, 50000);
  const maxFileBytes = boundedInteger(args.maxFileBytes, 1024 * 1024, 1, MAX_READ_BYTES);
  const matches = [];
  let filesScanned = 0;
  const stack = [root];

  while (stack.length && filesScanned < maxFiles && matches.length < maxResults) {
    const current = stack.pop();
    let stat;
    try { stat = fs.lstatSync(current); } catch { continue; }
    if (stat.isDirectory()) {
      let entries = [];
      try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries.reverse()) {
        const child = path.join(current, entry.name);
        if (isProtectedSecretPath(child)) continue;
        if (entry.isDirectory() || entry.isFile()) stack.push(child);
      }
      continue;
    }
    if (!stat.isFile() || stat.size > maxFileBytes) continue;
    filesScanned += 1;
    let text;
    try { text = fs.readFileSync(current, "utf8"); } catch { continue; }
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length && matches.length < maxResults; index += 1) {
      const hay = caseSensitive ? lines[index] : lines[index].toLowerCase();
      if (hay.includes(needle)) {
        matches.push({ path: current, line: index + 1, text: lines[index].slice(0, 1500) });
      }
    }
  }

  return { ok: true, path: root, query, filesScanned, matches, truncated: matches.length >= maxResults || filesScanned >= maxFiles };
}

function requireExpectedSha(target, expectedSha256) {
  if (!expectedSha256) return;
  if (!fs.existsSync(target) || !fs.lstatSync(target).isFile()) {
    throw new Error("STALE_SHA_TARGET_MISSING");
  }
  const actual = sha256File(target);
  if (actual.toLowerCase() !== String(expectedSha256).toLowerCase()) {
    throw new Error(`STALE_SHA:${actual}`);
  }
}

export function fsWrite(args = {}) {
  const target = assertPathAllowed(args.path, "write");
  const mode = String(args.mode || "replace").toLowerCase();
  if (!new Set(["create", "replace", "append"]).has(mode)) throw new Error("FS_WRITE_MODE_INVALID");
  const encoding = String(args.encoding || "utf8");
  const content = String(args.content ?? "");
  if (Buffer.byteLength(content, encoding) > MAX_WRITE_BYTES) throw new Error("FS_WRITE_TOO_LARGE");
  const existed = fs.existsSync(target);
  if (mode === "create" && existed) throw new Error("FS_WRITE_CREATE_EXISTS");
  if (mode === "replace" && args.expectedSha256) requireExpectedSha(target, args.expectedSha256);
  if (args.createParents !== false) fs.mkdirSync(path.dirname(target), { recursive: true });
  if (mode === "append") fs.appendFileSync(target, content, encoding);
  else fs.writeFileSync(target, content, encoding);
  return { ok: true, path: target, mode, existed, bytesWritten: Buffer.byteLength(content, encoding), sha256: sha256File(target) };
}

export function fsMkdir(args = {}) {
  const target = assertPathAllowed(args.path, "write");
  fs.mkdirSync(target, { recursive: args.recursive !== false });
  return { ok: true, path: target, exists: true };
}

export function fsDelete(args = {}) {
  const target = assertPathAllowed(args.path, "write");
  if (!fs.existsSync(target)) return { ok: true, path: target, existed: false };
  const stat = fs.lstatSync(target);
  if (stat.isFile() && args.expectedSha256) requireExpectedSha(target, args.expectedSha256);
  fs.rmSync(target, { recursive: args.recursive === true, force: args.force === true });
  return { ok: true, path: target, existed: true };
}

export function fsMove(args = {}) {
  const source = assertPathAllowed(args.source, "write");
  const destination = assertPathAllowed(args.destination, "write");
  if (args.expectedSourceSha256) requireExpectedSha(source, args.expectedSourceSha256);
  if (fs.existsSync(destination) && !args.overwrite) throw new Error("FS_MOVE_DESTINATION_EXISTS");
  if (args.createParents !== false) fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (args.overwrite && fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
  fs.renameSync(source, destination);
  return { ok: true, source, destination };
}

export function fsCopy(args = {}) {
  const source = assertPathAllowed(args.source, "read");
  const destination = assertPathAllowed(args.destination, "write");
  if (args.expectedSourceSha256) requireExpectedSha(source, args.expectedSourceSha256);
  if (fs.existsSync(destination) && !args.overwrite) throw new Error("FS_COPY_DESTINATION_EXISTS");
  if (args.createParents !== false) fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: args.recursive === true, force: args.overwrite === true });
  return { ok: true, source, destination };
}

export function shellRun(args = {}) {
  const shell = String(args.shell || "powershell").toLowerCase();
  const command = String(args.command || "");
  if (!command) throw new Error("SHELL_COMMAND_REQUIRED");
  assertCommandAllowed(command);
  if (shell === "powershell" || shell === "pwsh") {
    const exe = shell === "pwsh" ? "pwsh.exe" : "powershell.exe";
    return runProcess(exe, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command], args);
  }
  if (shell === "cmd") return runProcess("cmd.exe", ["/d", "/s", "/c", command], args);
  throw new Error("SHELL_DENIED");
}

export function execRun(args = {}) {
  const executable = String(args.executable || "").trim();
  if (!executable) throw new Error("EXECUTABLE_REQUIRED");
  return runProcess(executable, Array.isArray(args.args) ? args.args : [], args);
}

export function processList(args = {}) {
  const filter = String(args.filter || "").toLowerCase();
  const limit = boundedInteger(args.limit, 500, 1, 5000);
  const probe = runProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress -Depth 3"], { timeoutMs: args.timeoutMs || DEFAULT_TIMEOUT_MS, maxOutputBytes: MAX_OUTPUT_BYTES });
  if (!probe.ok) return { ok: false, stage: "powershell", ...probe };
  let parsed = [];
  try { parsed = JSON.parse(probe.stdout || "[]"); } catch (error) { return { ok: false, error: `PROCESS_LIST_JSON_PARSE_FAILED:${error}` }; }
  const list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  const items = list.filter((item) => !filter || JSON.stringify(item).toLowerCase().includes(filter)).slice(0, limit);
  return { ok: true, items, truncated: items.length >= limit };
}

export function processStart(args = {}) {
  const executable = String(args.executable || "").trim();
  if (!executable) throw new Error("PROCESS_EXECUTABLE_REQUIRED");
  const requestedArgs = Array.isArray(args.args) ? args.args.map(String) : [];
  assertCommandAllowed([executable, ...requestedArgs].join(" "));
  const cwd = args.cwd ? assertPathAllowed(args.cwd, "read") : process.cwd();
  const env = sanitizeEnv(args.env);
  const stdoutPath = args.stdoutPath ? assertPathAllowed(args.stdoutPath, "write") : null;
  const stderrPath = args.stderrPath ? assertPathAllowed(args.stderrPath, "write") : null;
  if (stdoutPath) fs.mkdirSync(path.dirname(stdoutPath), { recursive: true });
  if (stderrPath) fs.mkdirSync(path.dirname(stderrPath), { recursive: true });
  const stdoutFd = stdoutPath ? fs.openSync(stdoutPath, args.appendOutput ? "a" : "w") : "ignore";
  const stderrFd = stderrPath ? fs.openSync(stderrPath, args.appendOutput ? "a" : "w") : "ignore";
  const child = spawn(executable, requestedArgs, { cwd, env, detached: args.detached !== false, windowsHide: true, stdio: ["ignore", stdoutFd, stderrFd] });
  if (typeof stdoutFd === "number") fs.closeSync(stdoutFd);
  if (typeof stderrFd === "number") fs.closeSync(stderrFd);
  if (args.detached !== false) child.unref();
  return { ok: true, pid: child.pid, executable, args: requestedArgs, cwd, detached: args.detached !== false, stdoutPath, stderrPath };
}

export function processStop(args = {}) {
  const pid = Number(args.pid);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error("PROCESS_PID_INVALID");
  const killArgs = ["/PID", String(pid), "/T"];
  if (args.force !== false) killArgs.push("/F");
  const result = runProcess("taskkill.exe", killArgs, { timeoutMs: args.timeoutMs || DEFAULT_TIMEOUT_MS });
  return { ...result, pid };
}

function gitBase(repo) {
  const root = assertPathAllowed(repo, "read");
  return { root, prefix: ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "-C", root] };
}

export function gitStatus(args = {}) {
  const { root, prefix } = gitBase(args.repo);
  return { repo: root, ...runProcess("git", [...prefix, "status", "--short", "--branch"], args) };
}

export function gitDiff(args = {}) {
  const { root, prefix } = gitBase(args.repo);
  const paths = Array.isArray(args.paths) ? args.paths.map(String) : [];
  return { repo: root, ...runProcess("git", [...prefix, "diff", ...(args.staged ? ["--cached"] : []), ...(paths.length ? ["--", ...paths] : [])], args) };
}

export function gitStage(args = {}) {
  const { root, prefix } = gitBase(args.repo);
  if (isProtectedWritePath(path.join(root, ".git", "config"))) {
    // This check documents that staging does not grant permission to mutate Git control config.
  }
  const paths = Array.isArray(args.paths) ? args.paths.map(String) : [];
  if (!args.all && !paths.length) throw new Error("GIT_STAGE_PATHS_REQUIRED");
  return { repo: root, ...runProcess("git", [...prefix, "add", ...(args.all ? ["-A"] : ["--", ...paths])], args) };
}

function gitHead(repo, args = {}) {
  const { root, prefix } = gitBase(repo);
  const result = runProcess("git", [...prefix, "rev-parse", "HEAD"], args);
  return result.ok ? result.stdout.trim().toLowerCase() : null;
}

export function gitCommit(args = {}) {
  const { root, prefix } = gitBase(args.repo);
  if (!args.message) throw new Error("GIT_COMMIT_MESSAGE_REQUIRED");
  const expectedHead = args.expectedHead ? String(args.expectedHead).toLowerCase() : null;
  const actualHead = gitHead(root, args);
  if (expectedHead && actualHead !== expectedHead) throw new Error(`GIT_STALE_HEAD:${actualHead || "unknown"}`);
  if (args.stageAll) {
    const staged = runProcess("git", [...prefix, "add", "-A"], args);
    if (!staged.ok) return { repo: root, stage: "stage", ...staged };
  } else if (Array.isArray(args.paths) && args.paths.length) {
    const staged = runProcess("git", [...prefix, "add", "--", ...args.paths.map(String)], args);
    if (!staged.ok) return { repo: root, stage: "stage", ...staged };
  }
  const identityArgs = [];
  if (args.authorName) identityArgs.push("-c", `user.name=${String(args.authorName)}`);
  if (args.authorEmail) identityArgs.push("-c", `user.email=${String(args.authorEmail)}`);
  const result = runProcess("git", [...identityArgs, ...prefix, "commit", ...(args.noVerify ? ["--no-verify"] : []), "-m", String(args.message)], args);
  return { repo: root, ...result, newHead: result.ok ? gitHead(root, args) : null };
}

export function gitRemote(args = {}) {
  const action = String(args.action || "").toLowerCase();
  if (!new Set(["clone", "fetch", "pull", "push"]).has(action)) throw new Error("GIT_REMOTE_ACTION_INVALID");
  if (action === "clone") {
    const destination = assertPathAllowed(args.destination, "write");
    const cwd = args.cwd ? assertPathAllowed(args.cwd, "read") : path.dirname(destination);
    const command = ["clone", ...(args.depth ? ["--depth", String(args.depth)] : []), String(args.url || ""), destination];
    return { action, ...runProcess("git", command, { ...args, cwd }) };
  }
  const { root, prefix } = gitBase(args.repo);
  const remote = String(args.remote || "origin");
  const ref = args.ref ? String(args.ref) : null;
  const command = action === "fetch"
    ? [...prefix, "fetch", remote, ...(ref ? [ref] : [])]
    : action === "pull"
      ? [...prefix, "pull", remote, ...(ref ? [ref] : [])]
      : [...prefix, "push", ...(args.setUpstream ? ["-u"] : []), remote, ...(ref ? [ref] : [])];
  return { action, repo: root, ...runProcess("git", command, args) };
}

export function runtimeInfo() {
  const probes = [
    ["node", ["--version"]],
    ["npm.cmd", ["--version"]],
    ["python", ["--version"]],
    ["git", ["--version"]],
    ["powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"]],
  ];
  const runtimes = {};
  for (const [exe, args] of probes) {
    const result = runProcess(exe, args, { timeoutMs: 5000, maxOutputBytes: 16 * 1024 });
    runtimes[exe] = { available: result.ok, version: (result.stdout || result.stderr || "").trim().slice(0, 500) };
  }
  return { ok: true, platform: process.platform, arch: process.arch, hostname: os.hostname(), node: process.version, cwd: process.cwd(), runtimes };
}

export function systemStatus() {
  return {
    ok: true,
    kind: "gpt-pc-bridge-status-v1",
    service: "ilynto-gpt-pc-bridge",
    version: "0.1.0",
    transport: "stdio",
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    cwd: process.cwd(),
    authority: "current-user",
    securityBoundary: {
      publicListener: false,
      protectedSecretPaths: true,
      protectedPersistenceWrites: true,
      exceptionalCommandBoundary: true,
      cryptographicSandbox: false,
    },
    orchestration: {
      semanticBatch: true,
      strategy: "dag",
      verificationAfterMutationRequired: true,
    },
  };
}

export const operations = Object.freeze({
  "system.status": systemStatus,
  "runtime.info": runtimeInfo,
  "fs.stat": fsStat,
  "fs.list": fsList,
  "fs.read": fsRead,
  "fs.search": fsSearch,
  "fs.write": fsWrite,
  "fs.mkdir": fsMkdir,
  "fs.delete": fsDelete,
  "fs.move": fsMove,
  "fs.copy": fsCopy,
  "shell.run": shellRun,
  "exec.run": execRun,
  "process.list": processList,
  "process.start": processStart,
  "process.stop": processStop,
  "git.status": gitStatus,
  "git.diff": gitDiff,
  "git.stage": gitStage,
  "git.commit": gitCommit,
  "git.remote": gitRemote,
});

export async function dispatchOperation(kind, args = {}) {
  const handler = operations[kind];
  if (!handler) throw new Error(`OPERATION_NOT_SUPPORTED:${kind}`);
  return await handler(args);
}

# Local PC Memory Sharing

Status: **GUIDE / OPTIONAL PATTERN**

This guide describes one practical way to let multiple ChatGPT/Codex/agent sessions share durable project memory through files on a user-owned PC.

It does **not** modify ChatGPT's built-in cloud memory. It creates a separate local memory surface that any authorized agent can read/write through the local PC bridge.

## What problem this solves

Normal chats are separate contexts. Even when an assistant has product memory, that is not a reliable substitute for project-state files, exact Git state, decisions, handoff notes, or reproducible checkpoints.

A local memory root gives multiple sessions a common source of truth:

```text
Chat A / Codex A
      |
      | checkpoint after verified work
      v
Local project memory (private)
  - PROJECT_STATE.json
  - CHECKPOINT.json
  - HANDOFF.md
  - DECISIONS.md (optional)
  - CANONICAL_STATE.json
  - .git/
      ^
      | resume before continuing
      |
Chat B / Codex B
```

The GPT-PC Bridge supplies filesystem/Git access. The memory directory remains private user state and must stay separate from disposable generated runtime.

## Recommended minimal files

### `PROJECT_STATE.json`

Current compact facts needed to continue work.

Good content:

- project identifier;
- current phase/goal;
- completed milestones;
- current branch/head if relevant;
- important environment facts;
- current next action;
- explicit blockers.

Avoid copying the whole conversation transcript.

### `CHECKPOINT.json`

The last verified semantic checkpoint.

It should answer:

```text
What outcome was just completed?
What evidence proved it?
What remains unfinished?
What state must not be replayed?
```

### `HANDOFF.md`

Human-readable continuation notes. Keep this short enough for a new session to read immediately.

Useful structure:

```text
Current goal
Completed
Important decisions
Current verified state
Next step
Known risks / do-not-repeat notes
```

### `DECISIONS.md` (optional)

Durable decisions that should survive implementation churn. Examples:

- why one architecture was chosen over another;
- why a specific provider route is required;
- why a dangerous fallback was rejected;
- user preferences that materially affect the project.

Do not use it as a raw activity log.

### `CANONICAL_STATE.json`

A manifest binding the current generation of memory files together.

Recommended fields:

```json
{
  "kind": "local-canonical-state-v1",
  "schemaVersion": 1,
  "projectId": "example-project",
  "generationId": "<uuid>",
  "observedAt": "<ISO-8601>",
  "files": [
    {"key":"state","path":"PROJECT_STATE.json","bytes":1234,"sha256":"..."},
    {"key":"checkpoint","path":"CHECKPOINT.json","bytes":567,"sha256":"..."},
    {"key":"handoff","path":"HANDOFF.md","bytes":890,"sha256":"..."}
  ]
}
```

The manifest prevents an agent from unknowingly combining `STATE` from one checkpoint with `HANDOFF` from another.

## Resume flow

Before continuing non-trivial work:

```text
locate memory root
-> verify memory root is the intended project
-> read canonical manifest if present
-> verify configured files/hash generation
-> read compact state/checkpoint/handoff
-> compare with current real environment/Git
-> prefer fresh real state when they conflict
-> continue
```

The important rule is:

> Memory is a continuation aid, not an authority over fresh observable reality.

For example, if `HANDOFF.md` says Git HEAD is `abc...` but current Git HEAD is different, treat the handoff as stale and investigate before mutation.

## Checkpoint flow

Create/update a checkpoint after a **verified semantic outcome**, not after every tool call or every chat message.

Recommended flow:

```text
complete meaningful work
-> focused verification succeeds
-> construct compact state/checkpoint/handoff
-> acquire one writer lock for the memory root
-> snapshot prior memory targets
-> write files atomically
-> build canonical manifest with hashes
-> Git add exact memory files
-> commit exact memory files
-> return checkpoint receipt
```

If checkpointing fails after the work itself succeeded, do not replay the completed work automatically. Repair the memory checkpoint separately.

## Why Git helps

A private local Git repository makes memory auditable and reversible:

- exact history of state transitions;
- compare what changed between sessions;
- recover a previous checkpoint;
- bind a resume to an exact memory commit;
- detect concurrent/stale edits.

A remote private Git repository is optional. Local-only Git is enough for same-PC sharing.

Never push private memory to a public repository.

## Concurrency

If multiple agents can write the same memory root, use a single-writer rule.

At minimum:

- one lock per physical memory root;
- bounded lock timeout;
- stale-lock recovery;
- atomic file replacement;
- exact-path Git commits;
- rollback of staged memory files if checkpoint creation fails.

Do not let two chats simultaneously rewrite `PROJECT_STATE.json` without coordination.

## Privacy and secrets

Local memory may contain sensitive project context. Treat it as private data.

Do not store:

- API keys/tokens/passwords;
- raw credential exports;
- private keys;
- unnecessary personal data;
- large raw logs that can be regenerated.

Store references such as `env:NAME`, secret-store key names, or redacted identifiers instead of secret values.

## Cross-chat example

### Session A

The user asks ChatGPT to modify a local app. After tests pass, ChatGPT writes a checkpoint recording:

```text
Completed: replaced old authentication flow
Verified: targeted tests 18/18 + Git diff reviewed
Next: deploy staging build
Do not repeat: database migration already applied
```

### Session B

Later, a new ChatGPT conversation reads the same memory root through GPT-PC Bridge, validates it against current Git, and continues from staging deployment rather than rediscovering the whole history.

This also works between ChatGPT and Codex if both are authorized to access the same local memory directory.

## Suggested user prompts

After GPT-PC Bridge is installed, a user can ask:

```text
Use the ILYNTO local-memory-sharing guide for this project. Create a private local project-memory directory, keep it separate from runtime/source, and checkpoint only verified semantic outcomes.
```

Or, when starting a new chat:

```text
Resume this project from its local canonical memory first, verify it against current Git/environment state, then continue.
```

## Relationship to private ILYNTO

This guide is a sanitized generalization of mechanisms proven in the maintainer's private ILYNTO system: compact `project.resume`, canonical state manifests, hash-verified memory files, Git-backed checkpoints, handoff files, serialized memory writes, rollback-on-checkpoint-failure, and automatic checkpointing only after verified outcomes.

The public guide intentionally does not require the private ILYNTO runtime or its registry layout.

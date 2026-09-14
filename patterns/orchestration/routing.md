# Routing — DIRECT by Default, GUARD by Exception, MANAGED by Need

Status: **PROVEN**

The routing model is intentionally simple. Performance degrades when every operation is forced through the heaviest available control path.

## Routes

### DIRECT

Default route for ordinary work that is already inside an authorized scope.

Typical examples:

- read/search/stat/list;
- ordinary project file mutation;
- tests/build/lint/typecheck;
- Git status/diff/stage/commit inside the approved project;
- routine local process execution;
- bounded runtime inspection.

DIRECT still enforces local security/path/command boundaries. "Direct" means no unnecessary extra orchestration hop.

### GUARD

A read-only preflight/classification route for exceptional boundaries.

GUARD should not itself perform the requested mutation. Its job is to answer whether the operation can stay DIRECT, requires a Human Boundary, is denied, needs replan, or should move to a stronger managed path.

Canonical Human Boundary reasons extracted from the live design:

- `privileged_authority_expansion`
- `security_weakening`
- `significant_spend`
- `external_publish_send`
- `irreversible_production_destruction`
- `release_approval_required`

A deployment may add domain-specific reasons, but should keep the list small and meaningful.

### MANAGED

A stronger semantic-job/governance path for work where additional policy/verification mechanics materially matter.

Examples:

- architecture changes requiring preflight;
- shared/live integration;
- concurrent-writer governance;
- release/promotion workflows;
- managed retry/repair with durable job semantics;
- workflows requiring explicit evidence/approval bindings.

MANAGED is not the fallback for every DIRECT error.

## Decision table

| Condition | Route / state |
|---|---|
| Routine eligible operation, scope already authorized | `DIRECT` |
| Explicit high-impact boundary flag | `HUMAN_BOUNDARY` via `GUARD` |
| Capability not admitted by project/policy | `POLICY_DENIED` |
| Expected source fence is stale | `REPLAN` |
| Conflicting active writer | `REPLAN` / ownership conflict |
| Risk cannot be classified safely | `REVIEW` or `REPLAN` |
| Architecture/release/governance semantics materially needed | `MANAGED` |
| DIRECT failure caused by ordinary runtime error | return evidence; decide/replan explicitly |

## Why no automatic fallback

Automatic fallback can silently change:

- authority scope;
- persistence model;
- network/control-plane dependency;
- latency;
- retry semantics;
- audit/evidence behavior;
- user approval requirements.

Therefore route changes should be explicit at a semantic boundary.

Bad:

```text
DIRECT failed -> secretly submit to cloud managed queue -> success
```

Good:

```text
DIRECT failed with reason X
-> classify whether X is mechanical, semantic, policy, or environment
-> repair/retry in same route if mechanical and safe
-> otherwise return REPLAN with evidence
-> choose new route explicitly
```

## Source/state fence interaction

A route may require a current fence such as Git HEAD or file SHA.

If an expected fence is supplied and no longer matches:

```text
state = REPLAN
reason = stale source/state
mutation = false
```

Do not "helpfully" remove the fence and continue.

## Writer ownership interaction

For scopes where concurrent mutation matters, the runtime should expose coarse ownership/lease state. A conflicting writer is not automatically a Human Boundary; it is usually a replan/wait/recovery condition.

Human interaction is needed only when conflict resolution itself requires owner intent.

## Guard implementation requirements

A portable GUARD should:

- reject secret values in ordinary request payloads when they should travel through a dedicated credential path;
- resolve the target/project/scope;
- check capability admission;
- check relevant source fence;
- check writer conflict when mutation is requested;
- classify explicit/automatic Human Boundary reasons;
- return an advisory state without mutation authority;
- avoid remote/network calls on every ordinary DIRECT request.

## Route state vocabulary

A useful small vocabulary is:

- `ALLOW`
- `REVIEW`
- `REPLAN`
- `HUMAN_BOUNDARY`
- `POLICY_DENIED`
- `TERMINAL_FAILURE`
- `COMPLETE_VERIFIED`

Keep route/state terms semantic. Avoid leaking queue implementation details into the agent contract.

## Reproduction acceptance

A generated runtime should demonstrate:

- ordinary safe work uses DIRECT without a GUARD call;
- a configured exceptional action enters GUARD/Human Boundary;
- stale source fences stop mutation;
- writer conflicts stop/replan mutation;
- MANAGED is selected because its semantics are needed, not because it is "safer by default";
- DIRECT/MANAGED failures never trigger a hidden cross-route fallback.

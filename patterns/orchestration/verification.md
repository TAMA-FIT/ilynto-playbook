# Verification — Prove the Outcome at the Right Boundary

Status: **PROVEN**

Verification is part of execution. A successful command, generated file, passing API response, or clean-looking diff is not automatically the requested outcome.

## Core rule

> Verify at the narrowest scope that is sufficient for the actual risk, and move broad verification to the meaningful integration/release boundary.

This avoids both false completion and repeated full-regression cost.

## Verification levels

### Level 1 — Focused local verification

Use for ordinary bounded changes.

Typical checks:

- exact changed file/content or expected hash;
- focused unit/integration test directly covering the change;
- relevant lint/typecheck when available;
- Git diff/status sanity;
- expected process/runtime state if the change affects a running process.

### Level 2 — Integration verification

Use when multiple components/contracts interact.

Typical checks:

- relevant subsystem suite;
- cross-component contract test;
- clean integration Git state;
- restart/reload evidence when runtime behavior is involved;
- rollback/recovery path where practical.

### Level 3 — Release/security/public-contract verification

Use for broad/shared/high-risk changes.

Typical checks:

- full canonical regression suite;
- lint/typecheck/build/package gates;
- fresh clone/fresh start/reproduction evidence;
- external/public contract checks;
- security boundary tests;
- release-specific approval/promotion evidence;
- post-release live health and targeted smoke.

## Do not run Full after every micro-change

Repeated full suites can dominate wall time while adding little new information if the change is still inside an isolated candidate/local workstream.

Better pattern:

```text
edit
-> focused test
-> deterministic repair/retest if needed
-> relevant lint/typecheck
-> continue related local work
-> full gate once at the meaningful integration/release boundary
```

Full verification is not weakened; it is moved to the boundary where its result has decision value.

## Verification must follow mutation

Within a semantic batch, all verification operations should depend on all mutation/finalization operations relevant to the claimed outcome.

A runtime should reject a mutation semantic step with no verification operation unless a higher-level managed job explicitly owns verification later and the caller is not claiming completion yet.

## Source and state evidence

Verification should bind results to the state that was actually tested.

Useful markers:

- Git commit HEAD/root tree;
- file SHA-256;
- package/build artifact digest;
- runtime version/boot id;
- API resource revision/ETag;
- test manifest/hash where appropriate.

Avoid reporting "tests passed" without enough revision context to know what was tested.

## Stale state

If an optimistic fence fails:

1. do not overwrite unknown current state;
2. refresh the minimum necessary state;
3. classify whether the original semantic decision is still valid;
4. mechanically rebase/reapply only if deterministic and safe;
5. otherwise return `SEMANTIC_DECISION_REQUIRED` / `REPLAN`.

## Deterministic repair

Keep repair inside the same semantic job when the fix does not require a new product/specification decision.

Examples:

- formatting output;
- known lint autofix;
- import/order correction;
- deterministic stale-hash refresh where contents are otherwise unchanged;
- bounded retry of a transient operation;
- known generated-file refresh;
- rerunning a focused test after such a fix.

Return to the model when repair changes semantics or multiple plausible fixes exist.

## Evidence compaction

The agent needs enough evidence to decide truth, not all raw logs.

Recommended terminal receipt:

```json
{
  "state": "COMPLETE_VERIFIED",
  "revision": "<source revision>",
  "verification": {
    "focused": [
      { "name": "targeted-test", "ok": true, "durationMs": 420 },
      { "name": "typecheck", "ok": true, "durationMs": 610 }
    ],
    "gitClean": true
  },
  "evidenceRefs": [],
  "unobserved": []
}
```

Large logs can remain local or in bounded artifacts referenced by the receipt.

## `UNOBSERVED`

Never convert missing evidence into success.

Examples:

- process restart was requested but post-restart health was not checked -> restart result is `UNOBSERVED`;
- push command returned success but external remote state was not queried when external confirmation matters -> remote final state may remain `UNOBSERVED`;
- browser action was issued but final UI state was not inspected -> outcome is not verified.

## Verification selection heuristic

Ask:

1. What exact state would prove the user's requested outcome?
2. What is the cheapest trustworthy observation of that state?
3. What regressions are plausible given the changed surface?
4. At what boundary does a broader regression suite actually change a decision?
5. What evidence must be tied to a source revision/hash?

## Reproduction acceptance

A portable runtime should prove:

- mutation cannot be reported complete without post-mutation evidence;
- focused tests are used for local changes;
- full verification is retained for broad/release boundaries rather than removed;
- stale fences fail closed to replan/refresh;
- deterministic repair can continue inside the same job;
- ambiguous repairs return to semantic reasoning;
- missing evidence is surfaced as `UNOBSERVED`.

export const HUMAN_BOUNDARY_REASONS = Object.freeze([
  "privileged_authority_expansion",
  "security_weakening",
  "significant_spend",
  "external_publish_send",
  "irreversible_production_destruction",
  "release_approval_required",
]);

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

/**
 * Pure routing decision helper.
 *
 * This function deliberately does not execute anything. It exists so a runtime
 * can keep route selection explicit and testable instead of hiding fallback
 * behavior inside dispatch code.
 */
export function chooseExecutionRoute(input = {}) {
  const explicitBoundaryReasons = unique(
    Array.isArray(input.humanBoundaryReasons)
      ? input.humanBoundaryReasons.map(String)
      : [],
  );

  const invalidBoundary = explicitBoundaryReasons.find(
    (reason) => !HUMAN_BOUNDARY_REASONS.includes(reason),
  );
  if (invalidBoundary) {
    throw new Error(`ROUTER_HUMAN_BOUNDARY_REASON_INVALID:${invalidBoundary}`);
  }

  if (input.preflightAvailable === false) {
    return {
      route: "GUARD",
      state: "REPLAN",
      reason: "PREFLIGHT_UNAVAILABLE",
      mutationAllowed: false,
      automaticFallback: false,
    };
  }

  if (input.policyAllowed === false) {
    return {
      route: "GUARD",
      state: "POLICY_DENIED",
      reason: "CAPABILITY_NOT_ADMITTED",
      mutationAllowed: false,
      automaticFallback: false,
    };
  }

  if (input.fenceMatches === false) {
    return {
      route: "GUARD",
      state: "REPLAN",
      reason: "STALE_SOURCE_OR_STATE_FENCE",
      mutationAllowed: false,
      automaticFallback: false,
    };
  }

  if (input.writerConflict === true) {
    return {
      route: "GUARD",
      state: "REPLAN",
      reason: "WORKSPACE_OWNERSHIP_CONFLICT",
      mutationAllowed: false,
      automaticFallback: false,
    };
  }

  if (explicitBoundaryReasons.length) {
    return {
      route: "GUARD",
      state: "HUMAN_BOUNDARY",
      reason: explicitBoundaryReasons[0],
      humanBoundaryReasons: explicitBoundaryReasons,
      mutationAllowed: false,
      automaticFallback: false,
    };
  }

  if (input.managedSemanticsNeeded === true) {
    return {
      route: "MANAGED",
      state: "ALLOW",
      reason: input.managedReason || "MANAGED_SEMANTICS_REQUIRED",
      mutationAllowed: input.mutationRequested === true,
      automaticFallback: false,
    };
  }

  const riskTier = String(input.riskTier || "low").toLowerCase();
  if (["high", "critical", "unknown"].includes(riskTier)) {
    return {
      route: "GUARD",
      state: "REVIEW",
      reason: "HIGH_OR_UNKNOWN_RISK_REVIEW",
      mutationAllowed: false,
      automaticFallback: false,
    };
  }

  if (input.directEligible === false) {
    return {
      route: "GUARD",
      state: "REPLAN",
      reason: "DIRECT_ROUTE_NOT_ELIGIBLE",
      mutationAllowed: false,
      automaticFallback: false,
    };
  }

  return {
    route: "DIRECT",
    state: "ALLOW",
    reason: "DIRECT_FAST_PATH",
    mutationAllowed: input.mutationRequested === true,
    automaticFallback: false,
  };
}

/**
 * Convert a route execution failure into an explicit replan receipt.
 * The caller may retry mechanically in the same route when its retry policy says
 * the failure is transient/deterministic. This helper is for failures that need
 * a semantic route decision.
 */
export function routeFailureReceipt(input = {}) {
  return {
    ok: false,
    route: input.route || null,
    state: "REPLAN",
    reason: String(input.reason || "ROUTE_EXECUTION_FAILED"),
    evidence: input.evidence || null,
    automaticFallback: false,
    suggestedRoutes: Array.isArray(input.suggestedRoutes)
      ? input.suggestedRoutes
      : [],
  };
}

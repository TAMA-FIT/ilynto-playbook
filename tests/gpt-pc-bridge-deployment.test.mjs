import test from "node:test";
import assert from "node:assert/strict";

import {
  DESCRIPTION_MARKER,
  RECIPE_ID,
  createDeploymentIdentity,
  deploymentStateFrom,
  matchesOwnedTunnel,
  parseManagedDescription,
  sanitizeDeviceLabel,
} from "../references/gpt-pc-bridge/deployment-identity.mjs";

const DEPLOYMENT_ID = "11111111-2222-3333-4444-555555555555";

test("production tunnel name is human-readable and device-specific", () => {
  const identity = createDeploymentIdentity({
    deviceLabel: "Bayashi Laptop",
    deploymentId: DEPLOYMENT_ID,
  });

  assert.equal(identity.tunnelName, "ILYNTO GPT-PC Bridge - Bayashi Laptop");
  assert.equal(identity.localAlias, "ilynto-gpt-pc-bridge-bayashi-laptop");
  assert.match(identity.tunnelDescription, /managed-by=ilynto-playbook/);
  assert.match(identity.tunnelDescription, /recipe=gpt-pc-bridge\.windows/);
  assert.match(identity.tunnelDescription, new RegExp(`deployment=${DEPLOYMENT_ID}`));
});

test("unsafe Windows filename characters are normalized in a display label", () => {
  assert.equal(sanitizeDeviceLabel('Laptop:Main/Owner?'), "Laptop-Main-Owner");
});

test("managed description is machine-readable", () => {
  const identity = createDeploymentIdentity({
    deviceLabel: "Laptop",
    deploymentId: DEPLOYMENT_ID,
  });
  const parsed = parseManagedDescription(identity.tunnelDescription);
  assert.equal(parsed.managed, true);
  assert.equal(parsed.recipeId, RECIPE_ID);
  assert.equal(parsed.deploymentId, DEPLOYMENT_ID);
});

test("reuse requires both exact tunnel id and exact deployment marker", () => {
  const identity = createDeploymentIdentity({
    deviceLabel: "Laptop",
    deploymentId: DEPLOYMENT_ID,
  });
  const tunnel = {
    id: "tunnel_0123456789abcdef0123456789abcdef",
    name: identity.tunnelName,
    description: identity.tunnelDescription,
  };
  const state = deploymentStateFrom(identity, tunnel);

  assert.equal(matchesOwnedTunnel(tunnel, state), true);
  assert.equal(matchesOwnedTunnel({ ...tunnel, id: "tunnel_deadbeefdeadbeefdeadbeefdeadbeef" }, state), false);
  assert.equal(matchesOwnedTunnel({ ...tunnel, description: "unrelated tunnel" }, state), false);
});

test("same display name alone is never enough for automatic reuse", () => {
  const identity = createDeploymentIdentity({
    deviceLabel: "Laptop",
    deploymentId: DEPLOYMENT_ID,
  });
  const state = {
    deploymentId: DEPLOYMENT_ID,
    tunnelId: "tunnel_0123456789abcdef0123456789abcdef",
  };
  const unrelated = {
    id: state.tunnelId,
    name: identity.tunnelName,
    description: `Same visible name but missing ${DESCRIPTION_MARKER}`,
  };

  assert.equal(matchesOwnedTunnel(unrelated, state), false);
});

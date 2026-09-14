import crypto from "node:crypto";

export const RECIPE_ID = "gpt-pc-bridge.windows";
export const TUNNEL_NAME_PREFIX = "ILYNTO GPT-PC Bridge - ";
export const LOCAL_ALIAS_PREFIX = "ilynto-gpt-pc-bridge-";
export const DESCRIPTION_MARKER = "managed-by=ilynto-playbook";

export function sanitizeDeviceLabel(value) {
  const raw = String(value || "").trim();
  const cleaned = raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .trim();
  return cleaned || "Windows PC";
}

export function deviceSlug(value) {
  const label = sanitizeDeviceLabel(value).toLowerCase();
  const slug = label
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (slug) return slug;
  return `pc-${crypto.createHash("sha256").update(label).digest("hex").slice(0, 8)}`;
}

export function createDeploymentIdentity({ deviceLabel, deploymentId } = {}) {
  const label = sanitizeDeviceLabel(deviceLabel);
  const id = String(deploymentId || crypto.randomUUID()).trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    throw new Error("DEPLOYMENT_ID_INVALID");
  }

  const slug = deviceSlug(label);
  return {
    recipeId: RECIPE_ID,
    deploymentId: id,
    deviceLabel: label,
    deviceSlug: slug,
    localAlias: `${LOCAL_ALIAS_PREFIX}${slug}`,
    tunnelName: `${TUNNEL_NAME_PREFIX}${label}`,
    tunnelDescription: [
      "Created by ILYNTO Playbook for GPT-PC Bridge.",
      DESCRIPTION_MARKER,
      `recipe=${RECIPE_ID}`,
      `deployment=${id}`,
      `device=${slug}`,
    ].join(" "),
  };
}

export function parseManagedDescription(description) {
  const text = String(description || "");
  const fields = {};
  for (const token of text.split(/\s+/)) {
    const index = token.indexOf("=");
    if (index <= 0) continue;
    fields[token.slice(0, index)] = token.slice(index + 1);
  }
  return {
    managed: text.includes(DESCRIPTION_MARKER),
    recipeId: fields.recipe || null,
    deploymentId: fields.deployment || null,
    deviceSlug: fields.device || null,
  };
}

export function matchesOwnedTunnel(tunnel, deploymentState) {
  if (!tunnel || !deploymentState) return false;
  const tunnelId = String(tunnel.id || "");
  const expectedTunnelId = String(deploymentState.tunnelId || "");
  if (!tunnelId || !expectedTunnelId || tunnelId !== expectedTunnelId) return false;

  const parsed = parseManagedDescription(tunnel.description);
  return (
    parsed.managed &&
    parsed.recipeId === RECIPE_ID &&
    parsed.deploymentId === String(deploymentState.deploymentId || "").toLowerCase()
  );
}

export function deploymentStateFrom(identity, tunnel) {
  if (!identity?.deploymentId) throw new Error("DEPLOYMENT_ID_REQUIRED");
  if (!tunnel?.id) throw new Error("TUNNEL_ID_REQUIRED");
  return {
    schemaVersion: 1,
    recipeId: RECIPE_ID,
    deploymentId: identity.deploymentId,
    deviceLabel: identity.deviceLabel,
    deviceSlug: identity.deviceSlug,
    localAlias: identity.localAlias,
    tunnelId: String(tunnel.id),
    tunnelName: String(tunnel.name || identity.tunnelName),
  };
}

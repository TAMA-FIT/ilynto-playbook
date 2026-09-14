import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

test("guide catalog points to the public post-install guides", () => {
  const catalog = read("catalog/guides.yaml");
  for (const relative of [
    "guides/local-pc-memory-sharing.md",
    "guides/ilynto-methods.md",
  ]) {
    assert.match(catalog, new RegExp(relative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(fs.existsSync(path.join(ROOT, relative)), true, `missing ${relative}`);
  }
});

test("post-install guides preserve the key ILYNTO continuity and operating contracts", () => {
  const memory = read("guides/local-pc-memory-sharing.md");
  assert.match(memory, /CANONICAL_STATE\.json/);
  assert.match(memory, /Memory is a continuation aid, not an authority over fresh observable reality/);
  assert.match(memory, /checkpoint after a \*\*verified semantic outcome\*\*/i);

  const methods = read("guides/ilynto-methods.md");
  for (const phrase of [
    "Fresh state before meaningful mutation",
    "One intent -> one verified outcome",
    "Risk-scoped safety",
    "No silent fallback across authority models",
    "Optimize Chat-to-Verified-Outcome",
  ]) assert.match(methods, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

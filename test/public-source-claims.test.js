import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const support = readFileSync(new URL("../support.html", import.meta.url), "utf8");
const publicCopy = `${index}\n${support}`;

test("public coverage accurately distinguishes Fort Morgan and Dauphin Island", () => {
  assert.match(publicCopy, /Fort Morgan[\s\S]*regional estimate inherited from the nearby official Gulf Shores flag/i);
  assert.match(publicCopy, /Dauphin Island[\s\S]*official town beach-safety guidance/i);
  assert.doesNotMatch(publicCopy, /Fort Morgan[\s\S]{0,300}estimated conditions based on nearby official weather or marine information/i);
});

test("public offline claim is limited to bundled guides and bounded saved conditions", () => {
  assert.match(publicCopy, /Beach Guide and Learn (?:library|safety library)[\s\S]{0,80}(?:available|bundled) offline/i);
  assert.match(publicCopy, /cached conditions can be stale/i);
});

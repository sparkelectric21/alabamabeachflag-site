import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../resources/jellyfish-stings.html", import.meta.url), "utf8");

test("jellyfish resource has canonical metadata and Red Cross attribution", () => {
  assert.match(html, /<title>Jellyfish Stings: What to Do/);
  assert.match(html, /rel="canonical" href="https:\/\/alabamabeachflag\.com\/resources\/jellyfish-stings"/);
  assert.match(html, /Source: American Red Cross/);
  assert.match(html, /View American Red Cross Guidance/);
  assert.match(html, /href="https:\/\/www\.redcross\.org\/take-a-class\/resources\/learn-first-aid\/jellyfish-stings" target="_blank" rel="noopener noreferrer"/);
});

test("jellyfish resource includes concise care and emergency guidance", () => {
  for (const phrase of ["Leave the water safely", "Remove visible tentacles carefully", "Flush with seawater", "at least 20 minutes", "Do not rub", "Call 911"]) assert.match(html, new RegExp(phrase));
  assert.match(html, /does not replace emergency medical care/i);
});

test("resource and admin layouts include narrow-width responsive rules", () => {
  const publicCss = readFileSync(new URL("../legal.css", import.meta.url), "utf8");
  const adminCss = readFileSync(new URL("../admin/admin.css", import.meta.url), "utf8");
  assert.match(publicCss, /@media \(max-width: 420px\)/);
  assert.match(adminCss, /@media\(max-width:560px\)/);
  assert.match(html, /name="viewport"/);
});

test("jellyfish template is form-only and does not invoke publication", () => {
  const editor = readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
  const selection = editor.slice(editor.indexOf('$("#template").addEventListener'), editor.indexOf('form.addEventListener("input"'));
  assert.match(selection, /jellyfishTemplateDraft/);
  assert.doesNotMatch(selection, /publish\s*\(/);
  assert.doesNotMatch(selection, /apiRequest\s*\(/);
});

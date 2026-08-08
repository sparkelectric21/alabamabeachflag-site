import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SCRIPTURES, getChicagoDateKey, selectScriptureForDate } from "../scripture.js";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const privacy = readFileSync(new URL("../privacy.html", import.meta.url), "utf8");
const intendedPassages = ["GEN.1.20", "PSA.95.5", "MRK.4.39", "JER.5.22", "PSA.113.3", "JOB.38.11", "GEN.1.10", "GEN.22.17", "MAT.13.1", "PSA.19.1", "JOB.38.12", "GEN.1.21", "ECC.1.5", "HAB.2.14", "MAT.4.19"];

test("curated collection contains exactly the 15 intended NKJV passages", () => {
  assert.equal(SCRIPTURES.length, 15);
  SCRIPTURES.forEach((scripture, index) => {
    assert.ok(scripture.reference);
    assert.ok(scripture.text);
    assert.equal(scripture.translation, "NKJV");
    const url = new URL(scripture.url);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "www.bible.com");
    assert.equal(url.pathname, `/bible/114/${intendedPassages[index]}.NKJV`);
  });
});

test("daily rotation is deterministic, consecutive, and wraps", () => {
  const first = new Date("2026-01-01T18:00:00Z");
  assert.equal(selectScriptureForDate(first), selectScriptureForDate(first));
  for (let day = 0; day < 15; day += 1) {
    assert.equal(selectScriptureForDate(new Date(Date.UTC(2026, 0, day + 1, 18))).reference, SCRIPTURES[day].reference);
  }
  assert.equal(selectScriptureForDate(new Date("2026-01-16T18:00:00Z")).reference, SCRIPTURES[0].reference);
  assert.equal(selectScriptureForDate(new Date("2026-01-31T18:00:00Z")), SCRIPTURES[0]);
  assert.equal(selectScriptureForDate(new Date("2026-02-01T18:00:00Z")), SCRIPTURES[1]);
  const yearEnd = selectScriptureForDate(new Date("2026-12-31T18:00:00Z"));
  const nextYear = selectScriptureForDate(new Date("2027-01-01T18:00:00Z"));
  assert.equal(SCRIPTURES[(SCRIPTURES.indexOf(yearEnd) + 1) % SCRIPTURES.length], nextYear);
});

test("America/Chicago controls the date across midnight and DST", () => {
  assert.equal(getChicagoDateKey(new Date("2026-08-08T06:00:00Z")), getChicagoDateKey(new Date("2026-08-09T04:59:59Z")));
  assert.equal(getChicagoDateKey(new Date("2026-03-08T05:59:59Z")), "2026-03-07");
  assert.equal(getChicagoDateKey(new Date("2026-03-08T06:00:00Z")), "2026-03-08");
  assert.equal(getChicagoDateKey(new Date("2026-11-01T04:59:59Z")), "2026-10-31");
  assert.equal(getChicagoDateKey(new Date("2026-11-01T05:00:00Z")), "2026-11-01");
});

test("homepage keeps the accessible progressive-enhancement fallback and translation identifier", () => {
  assert.match(index, /<h2 id="scripture-heading">Scripture by the Sea<\/h2>/);
  assert.match(index, /data-scripture-text>The sea is His, for He made it; And His hands formed the dry land\./);
  assert.match(index, /href="https:\/\/www\.bible\.com\/bible\/114\/PSA\.95\.5\.NKJV" target="_blank" rel="noopener noreferrer" aria-label="Read Psalm 95:5 on Bible\.com \(opens in a new tab\)"/);
  assert.match(index, /data-scripture-translation>NKJV<\/span>/);
});

test("full NKJV acknowledgment appears on Privacy and not the homepage", () => {
  const acknowledgment = /Scripture taken from the New King James Version®\. Copyright © 1982 by Thomas Nelson\. Used by permission\. All rights reserved\./;
  assert.doesNotMatch(index, acknowledgment);
  assert.match(privacy, /<section id="scripture-attribution"><h2>7\. Scripture attribution<\/h2>/);
  assert.match(privacy, acknowledgment);
});

test("scripture feature remains limited to the public homepage", () => {
  for (const page of ["support.html", "privacy.html", "terms.html", "admin/index.html"]) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
    assert.doesNotMatch(html, /Scripture by the Sea/);
  }
});

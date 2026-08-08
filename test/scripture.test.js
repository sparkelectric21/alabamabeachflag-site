import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SCRIPTURES, formatScriptureQuotation, getChicagoDateKey, renderDailyScripture, selectScriptureForDate } from "../scripture.js";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const privacy = readFileSync(new URL("../privacy.html", import.meta.url), "utf8");
const headers = readFileSync(new URL("../_headers", import.meta.url), "utf8");
const intendedPassages = ["GEN.1.20", "PSA.95.5", "MRK.4.39", "JER.5.22", "PSA.113.3", "JOB.38.11", "GEN.1.10", "GEN.22.17", "MAT.13.1", "PSA.19.1", "JOB.38.12", "GEN.1.21", "ECC.1.5", "HAB.2.14", "MAT.4.19"];
const verifiedTexts = [
  "Then God said, “Let the waters abound with an abundance of living creatures, and let birds fly above the earth across the face of the firmament of the heavens.”",
  "The sea is His, for He made it; And His hands formed the dry land.",
  "Then He arose and rebuked the wind, and said to the sea, “Peace, be still!” And the wind ceased and there was a great calm.",
  "‘Do you not fear Me?’ says the LORD. ‘Will you not tremble at My presence, Who have placed the sand as the bound of the sea, By a perpetual decree, that it cannot pass beyond it? And though its waves toss to and fro, Yet they cannot prevail; Though they roar, yet they cannot pass over it.",
  "From the rising of the sun to its going down The LORD’s name is to be praised.",
  "When I said, ‘This far you may come, but no farther, And here your proud waves must stop!’",
  "And God called the dry land Earth, and the gathering together of the waters He called Seas. And God saw that it was good.",
  "blessing I will bless you, and multiplying I will multiply your descendants as the stars of the heaven and as the sand which is on the seashore; and your descendants shall possess the gate of their enemies.",
  "On the same day Jesus went out of the house and sat by the sea.",
  "The heavens declare the glory of God; And the firmament shows His handiwork.",
  "“Have you commanded the morning since your days began, And caused the dawn to know its place,",
  "So God created great sea creatures and every living thing that moves, with which the waters abounded, according to their kind, and every winged bird according to its kind. And God saw that it was good.",
  "The sun also rises, and the sun goes down, And hastens to the place where it arose.",
  "For the earth will be filled With the knowledge of the glory of the Lord, As the waters cover the sea.",
  "Then He said to them, “Follow Me, and I will make you fishers of men.”",
];

test("curated collection contains exactly the 15 intended NKJV passages", () => {
  assert.equal(SCRIPTURES.length, 15);
  assert.deepEqual(SCRIPTURES.map(({ text }) => text), verifiedTexts);
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

test("presentation adds outer quotation marks and correctly nests internal dialogue", () => {
  assert.equal(formatScriptureQuotation(SCRIPTURES[1].text), "“The sea is His, for He made it; And His hands formed the dry land.”");
  assert.equal(
    formatScriptureQuotation(SCRIPTURES[2].text),
    "“Then He arose and rebuked the wind, and said to the sea, ‘Peace, be still!’ And the wind ceased and there was a great calm.”",
  );
});

test("daily renderer applies the quotation presentation without changing stored text", () => {
  const elements = {
    "[data-scripture-text]": { textContent: "" },
    "[data-scripture-link]": { textContent: "", href: "", setAttribute(name, value) { this[name] = value; } },
    "[data-scripture-translation]": { textContent: "" },
  };
  const root = { querySelector: (selector) => elements[selector] };
  renderDailyScripture(new Date("2026-01-03T18:00:00Z"), root);
  assert.equal(elements["[data-scripture-text]"].textContent, "“Then He arose and rebuked the wind, and said to the sea, ‘Peace, be still!’ And the wind ceased and there was a great calm.”");
  assert.equal(elements["[data-scripture-link]"].href, "https://www.bible.com/bible/114/MRK.4.39.NKJV");
  assert.equal(elements["[data-scripture-translation]"].textContent, "NKJV");
  assert.equal(SCRIPTURES[2].text, verifiedTexts[2]);
});

test("homepage loads a cache-busted, revalidated Scripture module", () => {
  assert.match(index, /<script type="module" src="scripture\.js\?v=visible-quotes"><\/script>/);
  assert.match(headers, /\/scripture\.js\s+Cache-Control: no-cache/);
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
  assert.match(index, /data-scripture-text>“The sea is His, for He made it; And His hands formed the dry land\.”/);
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

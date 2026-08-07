import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicPages = [
  "../index.html",
  "../support.html",
  "../privacy.html",
  "../terms.html",
  "../resources/jellyfish-stings.html",
];

const facebookLink = /<footer>[\s\S]*?<a href="https:\/\/www\.facebook\.com\/profile\.php\?id=61593004013678" target="_blank" rel="noopener noreferrer">Facebook<\/a>[\s\S]*?<\/footer>/;

test("public page footers link accessibly and safely to the official Facebook page", () => {
  for (const page of publicPages) {
    const html = readFileSync(new URL(page, import.meta.url), "utf8");
    assert.match(html, facebookLink, `${page} should include the official Facebook link in its footer`);
  }
});

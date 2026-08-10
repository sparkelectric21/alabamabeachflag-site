import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = [
  "admin/index.html",
  "admin/announcements/index.html",
  "admin/events/index.html",
  "admin/provider-health/index.html",
  "admin/verification/index.html",
  "admin/operational-control/index.html",
  "admin/historical-data/index.html"
];

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const expectedOrder = ["Dashboard", "Announcements", "Events", "Provider Health", "Verification", "Operational Control", "Historical Data"];

for (const path of pages) {
  test(`${path} uses the shared accessible admin navigation`, () => {
    const html = read(path);
    assert.match(html, /responsive\.css/);
    assert.match(html, /navigation\.js/);
    assert.match(html, /class="nav-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="admin-sections"/);
    assert.match(html, /class="nav-links" id="admin-sections"/);
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    for (const destination of expectedOrder) {
      assert.match(html, new RegExp(`>${destination}<`));
    }
    const nav = html.match(/<div class="nav-links"[^>]*>(.*?)<button/s)?.[1] || "";
    assert.deepEqual([...nav.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map(match => match[1]), expectedOrder);
    const current = nav.match(/<a[^>]*aria-current="page"[^>]*>([^<]+)<\/a>/)?.[1];
    const expectedCurrent = path === "admin/index.html" ? "Dashboard" : path === "admin/announcements/index.html" ? "Announcements" : expectedOrder.find(label => path.toLowerCase().includes(label.toLowerCase().replaceAll(" ", "-")) || (label === "Events" && path.includes("events")) || (label === "Verification" && path.includes("verification")));
    assert.equal(current, expectedCurrent);
  });
}

test("shared responsive styles prevent fixed-width mobile navigation regressions", () => {
  const css = read("admin/responsive.css");
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /width:min\(340px,calc\(100vw - 32px\)\)/);
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /min-height:46px/);
  assert.doesNotMatch(css, /\.nav-links a:first-child\{display:none\}/);
});

test("mobile navigation supports expanded state, Escape, and focus restoration", () => {
  const source = read("admin/navigation.js");
  assert.match(source, /aria-expanded/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /restoreFocus/);
  assert.match(source, /aria-current='page'/);
  assert.doesNotMatch(source, /Historical Data/);
});

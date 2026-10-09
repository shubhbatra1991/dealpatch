import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroDemo } from "../features/landing/hero-demo";
import { ProductShowcase } from "../features/landing/product-showcase";

test("landing islands render a complete SSR fallback without browser APIs or live announcements", () => {
  const hero = renderToStaticMarkup(createElement(HeroDemo));
  assert.match(hero, /data-step="8"/);
  assert.match(hero, /2 changes applied/);
  assert.match(hero, /Static demo/);
  assert.doesNotMatch(hero, /aria-live|role="status"/);
  const showcase = renderToStaticMarkup(createElement(ProductShowcase));
  assert.match(showcase, /role="tablist" aria-label="Product views"/);
  assert.equal((showcase.match(/role="tabpanel"/g) ?? []).length, 4);
  assert.equal((showcase.match(/aria-selected="true"/g) ?? []).length, 1);
  assert.match(showcase, /Example pipeline opportunities/);
});

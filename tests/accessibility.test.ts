import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { DealPatchDatabase } from "../lib/db/database";
import { createReviewRepository } from "../lib/repositories/reviews";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { FavoriteButton } from "../features/favorites/favorite-button";
import { ReviewCard } from "../features/reviews/review-card";
import { renderWithKeyboard } from "./keyboard-provider";

test("review diffs name the field and retain captured/current/proposed conflict semantics", async () => {
  const db = new DealPatchDatabase(`a11y-${randomUUID()}`);
  const client = createQueryClient();
  try {
    const repo = createReviewRepository(db);
    const original = (await repo.getQueue())[0];
    await db.deals.update(original.proposal.dealId!, { probability: 35 });
    const item = (await repo.getQueue())[0];
    const html = renderWithKeyboard(createElement(QueryClientProvider, { client }, createElement(ReviewCard, { item, active: true, onReviewed: () => {}, onActivate: () => {} })));
    assert.match(html, /role="group" aria-label="Probability on .*: current and proposed values"/);
    assert.match(html, /Current value<\/span><span[^>]*>35%/);
    assert.match(html, /Proposed value<\/span><span[^>]*>45%/);
    assert.match(html, /Original captured value:<\/strong> <span[^>]*>20%/);
    assert.match(html, /role="status" aria-atomic="true"[^>]*>Conflict detected/);
    assert.match(html, /Select Probability on [^"]*" type="checkbox"[^>]*disabled/);
  } finally { client.clear(); await db.delete(); }
});

test("record-specific favorite names retain the pressed state and hide decorative stars", () => {
  const client = createQueryClient();
  const target = { entityType: "account" as const, entityId: "account_001", recordName: "Avelmere Systems" };
  const render = () => renderWithKeyboard(createElement(QueryClientProvider, { client }, createElement(FavoriteButton, target)));
  try {
    client.setQueryData(queryKeys.favorites.list, []);
    assert.match(render(), /aria-label="Add Avelmere Systems to favorites"[^>]*aria-pressed="false"/);
    assert.match(render(), /<svg[^>]*fill="none"[^>]*aria-hidden="true"/);
    client.setQueryData(queryKeys.favorites.list, [{ id: "favorite_001", entityType: "account", entityId: target.entityId, createdAt: "2026-10-01T00:00:00.000Z" }]);
    const html = render();
    assert.match(html, /aria-label="Remove Avelmere Systems from favorites"[^>]*aria-pressed="true"/);
    assert.match(html, /<svg[^>]*fill="currentColor"[^>]*aria-hidden="true"/);
  } finally { client.clear(); }
});

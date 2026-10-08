import assert from "node:assert/strict";
import test from "node:test";
import { workspaceAction } from "../lib/utils/keyboard";

test("maps list navigation, opening and explicit review actions", () => {
  assert.equal(workspaceAction("j"), "next");
  assert.equal(workspaceAction("k"), "previous");
  assert.equal(workspaceAction("Enter"), "open");
  assert.equal(workspaceAction("a"), "approve");
  assert.equal(workspaceAction("r"), "reject");
});

test("held keys can navigate but cannot repeat approval, rejection or opening", () => {
  assert.equal(workspaceAction("j", true), "next");
  assert.equal(workspaceAction("k", true), "previous");
  for (const key of ["a", "r", "Enter"]) assert.equal(workspaceAction(key, true), undefined);
});

test("does not map uppercase or unrelated character keys to actions", () => {
  for (const key of ["A", "R", "J", "K", "Escape", " ", "x"]) assert.equal(workspaceAction(key), undefined);
});

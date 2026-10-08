export type WorkspaceAction = "next" | "previous" | "open" | "approve" | "reject";

export function workspaceAction(key: string, repeat = false): WorkspaceAction | undefined {
  if (key === "j") return "next";
  if (key === "k") return "previous";
  if (repeat) return;
  if (key === "Enter") return "open";
  if (key === "a") return "approve";
  if (key === "r") return "reject";
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])');
}

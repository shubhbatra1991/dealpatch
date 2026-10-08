import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceKeyboardContext } from "../components/layout/workspace-keyboard";

export function renderWithKeyboard(element: ReactNode) {
  return renderToStaticMarkup(createElement(WorkspaceKeyboardContext.Provider, { value: {
    register: () => () => {}, showCommands: () => {}, showHelp: () => {}, singleKeys: true,
  } }, element));
}

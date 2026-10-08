"use client";

import { useEffect, useState } from "react";
import { initializeWorkspace } from "@/lib/db/workspace";

type WorkspaceStatus = "loading" | "ready" | "error";

export function useWorkspaceInitialization() {
  const [status, setStatus] = useState<WorkspaceStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    initializeWorkspace().then(
      () => { if (active) setStatus("ready"); },
      () => { if (active) setStatus("error"); },
    );
    return () => { active = false; };
  }, [attempt]);

  function retry() {
    setStatus("loading");
    setAttempt((value) => value + 1);
  }

  return { status, retry };
}

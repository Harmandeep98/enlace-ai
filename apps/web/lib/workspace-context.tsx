"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getMyWorkspace } from "@/lib/api-client";

interface WorkspaceState {
  workspaceId: string | null;
  loading: boolean;
  error: string | null;
}

const WorkspaceContext = createContext<WorkspaceState>({ workspaceId: null, loading: true, error: null });

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkspaceState>({ workspaceId: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    getMyWorkspace().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setState({ workspaceId: result.workspaceId, loading: false, error: null });
      } else {
        setState({ workspaceId: null, loading: false, error: result.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <WorkspaceContext.Provider value={state}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  return useContext(WorkspaceContext);
}

import { useCallback, useEffect, useState } from "react";
import type { UpdateState } from "../types";

/** The desktop app's update state (null in the browser, where there is nothing to update). */
export function useUpdater() {
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getUpdateState) return;
    let active = true;
    // A pushed state is newer than the first read, so it must not be overwritten by it.
    void api.getUpdateState().then((initial) => { if (active) setState((current) => current ?? initial); });
    const unsubscribe = api.onUpdateState(setState);
    return () => { active = false; unsubscribe(); };
  }, []);

  const check = useCallback(() => { void window.electronAPI?.checkForUpdates(); }, []);
  const install = useCallback(() => { void window.electronAPI?.installUpdate(); }, []);
  const openReleasePage = useCallback(() => { void window.electronAPI?.openReleasePage(); }, []);

  return { state, check, install, openReleasePage };
}

import { useEffect, useState } from "react";
import { AppSnapshot } from "../shared/protocol";
import { companionApi } from "../services/api";

export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    companionApi.getSnapshot().then((value) => {
      if (mounted) setSnapshot(value as AppSnapshot);
    });
    const unsubscribe = companionApi.onSnapshot((value) => {
      setSnapshot(value as AppSnapshot);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return snapshot;
}

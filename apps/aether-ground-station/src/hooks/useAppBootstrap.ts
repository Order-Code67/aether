import { useEffect } from "react";
import { getAppInfo } from "@/services/tauri";
import { useAppStore } from "@/stores/appStore";

export function useAppBootstrap(): void {
  const setAppInfo = useAppStore((s) => s.setAppInfo);
  const setReady = useAppStore((s) => s.setReady);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const info = await getAppInfo();
      if (cancelled) return;
      setAppInfo(info);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [setAppInfo, setReady]);
}

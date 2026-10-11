import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useTheme } from "@/hooks/useTheme";
import { activateBuiltinPlugins } from "@/core/plugins/builtin";

export default function App() {
  useTheme();

  useEffect(() => {
    activateBuiltinPlugins();
  }, []);

  return <AppShell />;
}

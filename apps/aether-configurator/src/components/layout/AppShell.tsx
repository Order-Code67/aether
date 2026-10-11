import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { ConnectionBar } from "./ConnectionBar";
import { TabHost } from "@/components/tabs/TabHost";

export function AppShell() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-app text-fg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <ConnectionBar />
        <main className="min-h-0 flex-1 overflow-auto p-4">
          <TabHost />
        </main>
      </div>
    </div>
  );
}

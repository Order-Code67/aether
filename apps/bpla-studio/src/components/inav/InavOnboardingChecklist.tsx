import { useEffect, useMemo } from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { useInavStore } from "@/stores/inavStore";
import { useSerialStore } from "@/stores/serialStore";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type StepId = "port" | "connect" | "status" | "diff" | "configurator";

interface ChecklistState {
  dismissed: boolean;
  collapsed: boolean;
  completed: Partial<Record<StepId, boolean>>;
  setDismissed: (v: boolean) => void;
  setCollapsed: (v: boolean) => void;
  mark: (id: StepId, done?: boolean) => void;
  reset: () => void;
}

const useInavChecklistStore = create<ChecklistState>()(
  persist(
    (set) => ({
      dismissed: false,
      collapsed: false,
      completed: {},
      setDismissed: (v) => set({ dismissed: v }),
      setCollapsed: (v) => set({ collapsed: v }),
      mark: (id, done = true) =>
        set((s) => ({ completed: { ...s.completed, [id]: done } })),
      reset: () => set({ completed: {}, dismissed: false, collapsed: false }),
    }),
    { name: "aether-inav-onboarding" },
  ),
);

const STEPS: { id: StepId; key: MessageKey }[] = [
  { id: "port", key: "inav.checklist.port" },
  { id: "connect", key: "inav.checklist.connect" },
  { id: "status", key: "inav.checklist.status" },
  { id: "diff", key: "inav.checklist.diff" },
  { id: "configurator", key: "inav.checklist.configurator" },
];

interface Props {
  onOpenConfigurator: () => void;
  onRefreshStatus: () => void;
  onGetDiff: () => void;
}

export function InavOnboardingChecklist({
  onOpenConfigurator,
  onRefreshStatus,
  onGetDiff,
}: Props) {
  const { t } = useI18n();
  const dismissed = useInavChecklistStore((s) => s.dismissed);
  const collapsed = useInavChecklistStore((s) => s.collapsed);
  const completed = useInavChecklistStore((s) => s.completed);
  const setDismissed = useInavChecklistStore((s) => s.setDismissed);
  const setCollapsed = useInavChecklistStore((s) => s.setCollapsed);
  const mark = useInavChecklistStore((s) => s.mark);

  const selectedPath = useSerialStore((s) => s.selectedPath);
  const connected = useSerialStore((s) => s.connected);
  const sessionActive = useInavStore((s) => s.sessionActive);
  const mspSnapshot = useInavStore((s) => s.mspSnapshot);
  const lastDiffPath = useInavStore((s) => s.lastDiffPath);
  const diffBuffer = useInavStore((s) => s.diffBuffer);

  useEffect(() => {
    if (selectedPath) mark("port", true);
  }, [selectedPath, mark]);

  useEffect(() => {
    if (connected && sessionActive) mark("connect", true);
  }, [connected, sessionActive, mark]);

  useEffect(() => {
    if (mspSnapshot?.fcVariant || mspSnapshot?.status) mark("status", true);
  }, [mspSnapshot, mark]);

  useEffect(() => {
    if (lastDiffPath || diffBuffer.trim()) mark("diff", true);
  }, [lastDiffPath, diffBuffer, mark]);

  const doneCount = useMemo(
    () => STEPS.filter((s) => completed[s.id]).length,
    [completed],
  );

  if (dismissed) return null;

  return (
    <section
      className="rounded border border-aether-accent/40 bg-aether-accent-muted/20 p-2"
      data-testid="inav-checklist"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex min-w-0 flex-1 items-center gap-1 text-left text-[11px] font-medium text-aether-fg"
        >
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          <span className="truncate">
            {t("inav.checklist.title")} ({doneCount}/{STEPS.length})
          </span>
        </button>
        <button
          type="button"
          title={t("inav.checklist.dismiss")}
          onClick={() => setDismissed(true)}
          className="rounded p-0.5 text-aether-fg-dim hover:bg-aether-surface-raised hover:text-aether-fg"
        >
          <X size={12} />
        </button>
      </div>
      {!collapsed && (
        <ol className="mt-2 space-y-1">
          {STEPS.map((step, i) => {
            const done = !!completed[step.id];
            return (
              <li key={step.id} className="flex items-start gap-2 text-[11px]">
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                    done
                      ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
                      : "border-aether-border text-aether-fg-dim",
                  )}
                >
                  {done ? <Check size={10} /> : <span>{i + 1}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn(done && "text-aether-fg-dim")}>
                    {t(step.key)}
                  </p>
                  {!done && step.id === "status" && (
                    <button
                      type="button"
                      className="text-[10px] text-aether-accent hover:underline"
                      onClick={onRefreshStatus}
                    >
                      {t("inav.msp.refresh")}
                    </button>
                  )}
                  {!done && step.id === "diff" && (
                    <button
                      type="button"
                      className="text-[10px] text-aether-accent hover:underline"
                      onClick={onGetDiff}
                    >
                      {t("inav.getDiff")}
                    </button>
                  )}
                  {step.id === "configurator" && (
                    <button
                      type="button"
                      className="text-[10px] text-aether-accent hover:underline"
                      onClick={() => {
                        onOpenConfigurator();
                        mark("configurator", true);
                      }}
                    >
                      {t("inav.openConfigurator")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-1.5 text-[10px] text-aether-fg-dim">
        {t("inav.checklist.hint")}
      </p>
    </section>
  );
}

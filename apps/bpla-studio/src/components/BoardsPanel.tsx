import boards from "@/data/boards.json";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import {
  useFirmwareFamilyStore,
  type FirmwareFamily,
} from "@/stores/firmwareFamilyStore";

type Board = {
  id: string;
  name: string;
  mcu: string;
  families: FirmwareFamily[];
  category: string;
  targets: Partial<Record<FirmwareFamily, string>>;
};

const ALL = boards as Board[];

export function BoardsPanel() {
  const { t } = useI18n();
  const family = useFirmwareFamilyStore((s) => s.family);
  const selectedBoardId = useFirmwareFamilyStore((s) => s.selectedBoardId);
  const setFamily = useFirmwareFamilyStore((s) => s.setFamily);
  const setSelectedBoardId = useFirmwareFamilyStore((s) => s.setSelectedBoardId);

  const filtered = ALL.filter((b) => b.families.includes(family));

  return (
    <section className="space-y-2 border-b border-aether-border px-3 pb-2">
      <p className="text-[10px] uppercase tracking-wide text-aether-fg-dim">
        {t("studio.family")}
      </p>
      <div className="flex flex-wrap gap-1">
        {(["inav", "betaflight", "ardupilot"] as FirmwareFamily[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFamily(f)}
            className={cn(
              "rounded px-2 py-1 text-[10px] font-medium uppercase",
              family === f
                ? "bg-aether-accent-muted text-aether-fg"
                : "text-aether-fg-dim hover:bg-aether-surface-raised",
            )}
          >
            {t(`studio.family.${f}` as "studio.family.inav")}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-aether-fg-dim">{t("studio.boardsHint")}</p>
      <p className="text-[10px] uppercase tracking-wide text-aether-fg-dim">
        {t("studio.boards")} ({filtered.length})
      </p>
      <ul className="aether-scroll max-h-40 space-y-0.5 overflow-auto">
        {filtered.length === 0 ? (
          <li className="text-[11px] text-aether-fg-dim">
            {t("studio.boardsEmpty")}
          </li>
        ) : (
          filtered.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setSelectedBoardId(b.id)}
                className={cn(
                  "w-full rounded px-2 py-1 text-left text-[11px]",
                  selectedBoardId === b.id
                    ? "bg-aether-accent-muted text-aether-fg"
                    : "text-aether-fg-dim hover:bg-aether-surface-raised hover:text-aether-fg",
                )}
              >
                <span className="block truncate font-medium">{b.name}</span>
                <span className="block truncate font-mono text-[9px] opacity-80">
                  {b.mcu} · {b.category} · {b.targets[family] ?? "—"}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useI18n } from "@/hooks/useI18n";
import { useMissionStore } from "@/stores/missionStore";
import type { WaypointAction } from "@/core/protocols/mission/types";

const ACTIONS: WaypointAction[] = [
  "waypoint",
  "rth",
  "poshold",
  "land",
  "jump",
  "set_poi",
];

export function NavigationTab() {
  const { t } = useI18n();
  const mission = useMissionStore((s) => s.mission);
  const selectedId = useMissionStore((s) => s.selectedId);
  const addWaypoint = useMissionStore((s) => s.addWaypoint);
  const removeWaypoint = useMissionStore((s) => s.removeWaypoint);
  const updateWaypoint = useMissionStore((s) => s.updateWaypoint);
  const setSelected = useMissionStore((s) => s.setSelected);
  const rename = useMissionStore((s) => s.rename);
  const exportCli = useMissionStore((s) => s.exportCli);
  const clear = useMissionStore((s) => s.clear);

  const selected = mission.waypoints.find((w) => w.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("nav.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("nav.hint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={addWaypoint}>
            {t("nav.add")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void navigator.clipboard.writeText(exportCli())}
          >
            {t("nav.copy")}
          </Button>
          <Button variant="ghost" onClick={clear}>
            {t("nav.reset")}
          </Button>
        </div>
      </div>

      <Card>
        <label className="block text-xs">
          <span className="text-fg-muted">{t("nav.name")}</span>
          <Input
            className="mt-1 max-w-sm"
            value={mission.name}
            onChange={(e) => rename(e.target.value)}
          />
        </label>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardTitle>{t("nav.list")}</CardTitle>
          <CardHint>{t("nav.listHint", { count: String(mission.waypoints.length) })}</CardHint>
          <ul className="mt-3 space-y-1">
            {mission.waypoints.map((wp) => (
              <li key={wp.id}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${
                    selectedId === wp.id
                      ? "bg-accent/15 text-accent"
                      : "hover:bg-surface-2"
                  }`}
                  onClick={() => setSelected(wp.id)}
                >
                  <span className="font-mono">
                    #{wp.id} {wp.action}
                  </span>
                  <span className="text-fg-muted">
                    {wp.action === "rth" || wp.action === "land"
                      ? "—"
                      : `${wp.lat.toFixed(5)}, ${wp.lon.toFixed(5)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>{t("nav.edit")}</CardTitle>
          {!selected ? (
            <p className="mt-2 text-xs text-fg-muted">{t("nav.select")}</p>
          ) : (
            <div className="mt-3 space-y-2 text-xs">
              <label className="block">
                <span className="text-fg-muted">{t("nav.action")}</span>
                <Select
                  className="mt-1"
                  value={selected.action}
                  onChange={(e) =>
                    updateWaypoint(selected.id, {
                      action: e.target.value as WaypointAction,
                    })
                  }
                >
                  {ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </label>
              {(["lat", "lon", "alt", "speed"] as const).map((key) => (
                <label key={key} className="block">
                  <span className="text-fg-muted">{key}</span>
                  <Input
                    type="number"
                    className="mt-1"
                    step={key === "lat" || key === "lon" ? 0.000001 : 1}
                    value={selected[key]}
                    onChange={(e) =>
                      updateWaypoint(selected.id, {
                        [key]: Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
              <Button
                variant="danger"
                onClick={() => removeWaypoint(selected.id)}
              >
                {t("nav.remove")}
              </Button>
            </div>
          )}
        </Card>
      </div>

      <p className="text-[11px] text-fg-muted">{t("nav.uploadNote")}</p>
    </div>
  );
}

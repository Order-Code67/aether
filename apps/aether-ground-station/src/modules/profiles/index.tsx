import { useRef, useState } from "react";
import { useProfileStore } from "@/stores/profileStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { ProfileExportBundle } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { COMPLEX_PRESETS, presetToProfileDraft } from "./presets";
import { validateProfileBundle } from "./importValidate";

export function ProfilesView() {
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const create = useProfileStore((s) => s.create);
  const update = useProfileStore((s) => s.update);
  const remove = useProfileStore((s) => s.remove);
  const duplicate = useProfileStore((s) => s.duplicate);
  const setActive = useProfileStore((s) => s.setActive);
  const exportProfile = useProfileStore((s) => s.exportProfile);
  const importProfile = useProfileStore((s) => s.importProfile);
  const applyTemplate = useWorkspaceStore((s) => s.applyTemplate);
  const workspaceId = useWorkspaceStore((s) => s.activeLayoutId);
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const active = profiles.find((p) => p.id === activeProfileId);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold">Профили комплексов</h1>
        <p className="mt-1 text-sm text-ags-muted">
          Готовые профили и пользовательские. Секреты в экспорт не попадают.
          Хранение — SQLite (зеркало через sync).
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ags-muted">
          Готовые профили
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COMPLEX_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="rounded border border-ags-border bg-ags-panel p-3 text-left hover:border-ags-accent/50"
              onClick={() => {
                const draft = presetToProfileDraft(preset);
                const p = create(draft.name);
                update(p.id, {
                  description: draft.description,
                  connectionParams: draft.connectionParams,
                  workspaceLayoutId: workspaceId,
                });
                applyTemplate(preset.workspaceTemplate);
                setActive(p.id);
                eventBus.emit("info", "profiles", `Профиль: ${preset.name}`);
              }}
            >
              <div className="font-semibold">{preset.name}</div>
              <div className="mt-1 text-xs text-ags-dim">{preset.description}</div>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border border-ags-border bg-ags-elevated px-3 py-1.5"
          placeholder="Название комплекса"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-ags-accent px-3 py-1.5 text-white"
          onClick={() => {
            const p = create(name);
            update(p.id, { workspaceLayoutId: workspaceId });
            setName("");
            eventBus.emit("info", "profiles", `Создан профиль: ${p.name}`);
          }}
        >
          Создать
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5"
          onClick={() => fileRef.current?.click()}
        >
          Импорт
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const parsed = JSON.parse(text) as unknown;
              const bundle = validateProfileBundle(parsed);
              if (!bundle) throw new Error("Неверный формат профиля");
              const p = importProfile(bundle as ProfileExportBundle);
              if (!p) throw new Error("Неверный формат");
              eventBus.emit("info", "profiles", `Импортирован: ${p.name}`);
            } catch (err) {
              eventBus.emit(
                "error",
                "profiles",
                err instanceof Error ? err.message : "Ошибка импорта",
              );
            }
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {profiles.map((p) => (
          <article
            key={p.id}
            className={`rounded border p-4 ${
              p.id === activeProfileId
                ? "border-ags-accent bg-ags-elevated"
                : "border-ags-border bg-ags-panel"
            }`}
          >
            <h3 className="font-semibold">{p.name}</h3>
            {p.description && (
              <p className="mt-1 text-xs text-ags-muted">{p.description}</p>
            )}
            <p className="mt-1 text-xs text-ags-dim">
              Обновлён {new Date(p.updatedAt).toLocaleString()}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                className="rounded border border-ags-border px-2 py-1"
                onClick={() => setActive(p.id)}
              >
                Активировать
              </button>
              <button
                type="button"
                className="rounded border border-ags-border px-2 py-1"
                onClick={() => {
                  update(p.id, { workspaceLayoutId: workspaceId });
                  eventBus.emit("info", "profiles", "Workspace сохранён в профиле");
                }}
              >
                Привязать layout
              </button>
              <button
                type="button"
                className="rounded border border-ags-border px-2 py-1"
                onClick={() => duplicate(p.id)}
              >
                Копия
              </button>
              <button
                type="button"
                className="rounded border border-ags-border px-2 py-1"
                onClick={() => {
                  const bundle = exportProfile(p.id);
                  if (!bundle) return;
                  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${p.name}.ags-profile.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Экспорт
              </button>
              <button
                type="button"
                className="rounded border border-ags-danger/40 px-2 py-1 text-ags-danger"
                onClick={() => remove(p.id)}
              >
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>

      {active && (
        <section className="rounded border border-ags-border bg-ags-panel p-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ags-muted">
            Активный профиль
          </h2>
          <p className="mt-2">{active.name}</p>
          <p className="text-xs text-ags-dim">
            Layout: {active.workspaceLayoutId ?? "не задан"}
          </p>
        </section>
      )}
    </div>
  );
}

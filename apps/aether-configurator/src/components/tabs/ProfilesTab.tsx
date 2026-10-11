import { useEffect, useState } from "react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/hooks/useI18n";
import { useConnectionStore } from "@/stores/connectionStore";
import {
  deleteProfile,
  listProfiles,
  saveProfile,
  type SavedProfile,
} from "@/lib/storage/indexedDb";

export function ProfilesTab() {
  const { t } = useI18n();
  const snapshot = useConnectionStore((s) => s.snapshot);
  const [name, setName] = useState("My craft");
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);

  async function reload() {
    setProfiles(await listProfiles());
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onSave() {
    await saveProfile({
      id: crypto.randomUUID(),
      name: name.trim() || "profile",
      craft: "unknown",
      protocol: "msp",
      notes: "Auto snapshot from Dashboard",
      payload: JSON.stringify(snapshot, null, 2),
    });
    await reload();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">
          {t("profiles.title")}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{t("profiles.hint")}</p>
      </div>

      <Card className="max-w-xl">
        <CardTitle>{t("profiles.save")}</CardTitle>
        <div className="mt-3 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("profiles.name")}
          />
          <Button variant="primary" onClick={() => void onSave()}>
            {t("profiles.save")}
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {profiles.length === 0 && (
          <Card>
            <p className="text-sm text-fg-muted">{t("profiles.empty")}</p>
          </Card>
        )}
        {profiles.map((p) => (
          <Card key={p.id} className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{p.name}</CardTitle>
              <CardHint>
                {new Date(p.updatedAt).toLocaleString()} · {p.protocol}
              </CardHint>
            </div>
            <Button
              variant="ghost"
              onClick={() => void deleteProfile(p.id).then(reload)}
            >
              {t("profiles.delete")}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

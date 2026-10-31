import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/stores/authStore";

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await login(username, password);
    setBusy(false);
    if (!ok) setError("Неверный логин или пароль");
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-ags-bg p-6">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-sm space-y-4 rounded-lg border border-ags-border bg-ags-panel p-6"
      >
        <div className="flex items-center gap-3">
          <img
            src="/aether-logo.jpg"
            alt=""
            className="h-12 w-12 rounded-md object-cover"
          />
          <div>
            <h1 className="text-lg font-semibold">Aether Ground Station</h1>
            <p className="text-xs text-ags-muted">Локальный вход</p>
          </div>
        </div>
        <label className="block text-xs text-ags-muted">
          Пользователь
          <input
            className="mt-1 w-full rounded border border-ags-border bg-ags-elevated px-3 py-2 text-sm text-ags-fg"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-xs text-ags-muted">
          Пароль
          <input
            type="password"
            className="mt-1 w-full rounded border border-ags-border bg-ags-elevated px-3 py-2 text-sm text-ags-fg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-xs text-ags-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-ags-accent py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Вход…" : "Войти"}
        </button>
        <p className="text-[11px] text-ags-dim">
          По умолчанию: admin / admin (смените после первого входа).
        </p>
      </form>
    </div>
  );
}

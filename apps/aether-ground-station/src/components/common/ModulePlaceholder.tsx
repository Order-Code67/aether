import type { ModuleDefinition } from "@/types";

interface ModulePlaceholderProps {
  module: ModuleDefinition;
}

export function ModulePlaceholder({ module }: ModulePlaceholderProps) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-3 p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-ags-dim">
        Этап {module.stage}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-ags-fg">
        {module.label}
      </h1>
      <p className="max-w-xl text-sm leading-relaxed text-ags-muted">
        {module.description}. Модуль зарезервирован в архитектуре v0.2.
        Фиктивные данные и имитация оборудования не используются.
      </p>
    </div>
  );
}

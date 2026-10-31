import type { GroundStationProfile } from "@/types";

export type ComplexPresetId =
  | "agriculture"
  | "firefighting"
  | "industrial"
  | "ground-robotics"
  | "monitoring"
  | "custom";

export interface ComplexPreset {
  id: ComplexPresetId;
  name: string;
  description: string;
  workspaceTemplate:
    | "standard"
    | "video"
    | "map"
    | "engineering"
    | "custom";
}

export const COMPLEX_PRESETS: ComplexPreset[] = [
  {
    id: "agriculture",
    name: "Agriculture",
    description: "Сельскохозяйственные комплексы",
    workspaceTemplate: "map",
  },
  {
    id: "firefighting",
    name: "Firefighting",
    description: "Пожарно-спасательные комплексы",
    workspaceTemplate: "video",
  },
  {
    id: "industrial",
    name: "Industrial",
    description: "Промышленные и инспекционные системы",
    workspaceTemplate: "engineering",
  },
  {
    id: "ground-robotics",
    name: "Ground Robotics",
    description: "Наземные роботизированные платформы",
    workspaceTemplate: "standard",
  },
  {
    id: "monitoring",
    name: "Monitoring",
    description: "Специализированные комплексы мониторинга",
    workspaceTemplate: "video",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Пользовательская конфигурация",
    workspaceTemplate: "custom",
  },
];

export function presetToProfileDraft(
  preset: ComplexPreset,
): Pick<GroundStationProfile, "name" | "description" | "connectionParams"> {
  return {
    name: preset.name,
    description: preset.description,
    connectionParams: { complexType: preset.id },
  };
}

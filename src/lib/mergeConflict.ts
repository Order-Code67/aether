export type ConflictChoice = "ours" | "theirs" | "both";

export interface ConflictRegion {
  id: string;
  /** 0-based index into original content where this conflict starts */
  start: number;
  end: number;
  oursLabel: string;
  theirsLabel: string;
  ours: string;
  theirs: string;
  /** Full text including conflict markers */
  raw: string;
}

const CONFLICT_RE =
  /<<<<<<<[^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>>[^\n]*\n?/g;

export function hasConflictMarkers(content: string): boolean {
  return content.includes("<<<<<<<") && content.includes(">>>>>>>");
}

export function parseConflicts(content: string): ConflictRegion[] {
  const regions: ConflictRegion[] = [];
  const re = new RegExp(CONFLICT_RE.source, "g");
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = re.exec(content)) !== null) {
    const raw = match[0];
    const header = raw.match(/^<<<<<<<\s*(.*)$/m);
    const footer = raw.match(/^>>>>>>>\s*(.*)$/m);
    regions.push({
      id: `conflict-${index++}`,
      start: match.index,
      end: match.index + raw.length,
      oursLabel: (header?.[1] ?? "Current").trim() || "Current",
      theirsLabel: (footer?.[1] ?? "Incoming").trim() || "Incoming",
      ours: match[1] ?? "",
      theirs: match[2] ?? "",
      raw,
    });
  }

  return regions;
}

function choiceText(region: ConflictRegion, choice: ConflictChoice): string {
  if (choice === "ours") return region.ours;
  if (choice === "theirs") return region.theirs;
  // both — keep ours then theirs without markers
  if (region.ours && region.theirs) {
    const a = region.ours.endsWith("\n") ? region.ours : `${region.ours}\n`;
    return a + region.theirs;
  }
  return region.ours || region.theirs;
}

/** Resolve a single conflict region by id. */
export function resolveConflict(
  content: string,
  conflictId: string,
  choice: ConflictChoice,
): string {
  const regions = parseConflicts(content);
  const region = regions.find((r) => r.id === conflictId);
  if (!region) {
    throw new Error("Conflict region not found (file may have changed).");
  }
  return (
    content.slice(0, region.start) +
    choiceText(region, choice) +
    content.slice(region.end)
  );
}

/** Resolve all conflicts with the same choice. */
export function resolveAllConflicts(
  content: string,
  choice: ConflictChoice,
): string {
  const regions = parseConflicts(content);
  if (regions.length === 0) return content;

  // Apply from the end so offsets stay valid
  let next = content;
  for (const region of [...regions].reverse()) {
    next =
      next.slice(0, region.start) +
      choiceText(region, choice) +
      next.slice(region.end);
  }
  return next;
}

export function conflictCount(content: string): number {
  return parseConflicts(content).length;
}

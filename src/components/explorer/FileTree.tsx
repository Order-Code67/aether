import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  filterTreeForSketchMode,
  isMainSketchPath,
  isSecondaryName,
  sortTreeForSketchMode,
} from "@/lib/sketchMode";
import { useEditorStore } from "@/stores/editorStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { FileTreeNode } from "@/types/workspace";

type MenuState = {
  x: number;
  y: number;
  path: string;
  kind: "file" | "folder";
  isRoot?: boolean;
};

type DraftKind = "file" | "folder" | "rename";

type DraftState = {
  kind: DraftKind;
  parentPath: string;
  /** For rename: original path */
  targetPath?: string;
  initial: string;
};

function promptName(message: string, initial: string): string | null {
  const value = window.prompt(message, initial);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function FileTreeNodeView({
  node,
  depth,
  isRoot,
  sketchFilter,
}: {
  node: FileTreeNode;
  depth: number;
  isRoot?: boolean;
  sketchFilter: boolean;
}) {
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const isMain =
    !!rootPath &&
    node.kind === "file" &&
    isMainSketchPath(node.path, rootPath);
  const isSecondary = node.kind === "file" && isSecondaryName(node.name);
  const defaultOpen =
    depth < 1 ||
    (sketchFilter && node.kind === "folder" && node.name.toLowerCase() === "src");
  const [open, setOpen] = useState(defaultOpen);
  const expandFolder = useWorkspaceStore((s) => s.expandFolder);
  const openPathInEditor = useWorkspaceStore((s) => s.openPathInEditor);
  const createFile = useWorkspaceStore((s) => s.createFile);
  const createFolder = useWorkspaceStore((s) => s.createFolder);
  const renameEntry = useWorkspaceStore((s) => s.renameEntry);
  const deleteEntry = useWorkspaceStore((s) => s.deleteEntry);
  const activePath = useEditorStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.path ?? null;
  });

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && node.kind === "folder" && !node.loaded) {
      void expandFolder(node.path);
    }
  }, [open, node.kind, node.loaded, node.path, expandFolder]);

  useEffect(() => {
    if (draft) {
      draftInputRef.current?.focus();
      draftInputRef.current?.select();
    }
  }, [draft]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const commitDraft = async () => {
    if (!draft) return;
    const name = draftInputRef.current?.value.trim() ?? "";
    setDraft(null);
    if (!name) return;
    if (draft.kind === "file") {
      await createFile(draft.parentPath, name);
    } else if (draft.kind === "folder") {
      await createFolder(draft.parentPath, name);
      setOpen(true);
    } else if (draft.kind === "rename" && draft.targetPath) {
      await renameEntry(draft.targetPath, name);
    }
  };

  const startNew = (kind: "file" | "folder") => {
    setOpen(true);
    setMenu(null);
    setDraft({
      kind,
      parentPath: node.path,
      initial: kind === "file" ? "untitled.cpp" : "NewFolder",
    });
  };

  const startRename = () => {
    setMenu(null);
    setDraft({
      kind: "rename",
      parentPath: node.path,
      targetPath: node.path,
      initial: node.name,
    });
  };

  const onDelete = () => {
    setMenu(null);
    if (isRoot) return;
    const ok = window.confirm(
      node.kind === "folder"
        ? `Delete folder "${node.name}" and all its contents?`
        : `Delete "${node.name}"?`,
    );
    if (!ok) return;
    void deleteEntry(node.path, node.kind === "folder");
  };

  const contextMenu = menu && menu.path === node.path && (
    <div
      className="fixed z-[80] min-w-[160px] rounded border border-aether-border bg-aether-surface py-1 shadow-xl"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {node.kind === "folder" && (
        <>
          <MenuItem
            icon={<FilePlus size={13} />}
            label="New File…"
            onClick={() => startNew("file")}
          />
          <MenuItem
            icon={<FolderPlus size={13} />}
            label="New Folder…"
            onClick={() => startNew("folder")}
          />
        </>
      )}
      {!isRoot && (
        <>
          <MenuItem
            icon={<Pencil size={13} />}
            label="Rename…"
            onClick={startRename}
          />
          <MenuItem
            icon={<Trash2 size={13} />}
            label="Delete…"
            danger
            onClick={onDelete}
          />
        </>
      )}
    </div>
  );

  const draftRow =
    draft &&
    draft.kind !== "rename" &&
    draft.parentPath === node.path ? (
      <div
        className="flex items-center gap-1 py-0.5 pr-2"
        style={{ paddingLeft: 8 + (depth + 1) * 12 + 14 }}
      >
        <input
          ref={draftInputRef}
          defaultValue={draft.initial}
          className="h-6 w-full min-w-0 rounded border border-aether-accent bg-aether-bg px-1 text-xs text-aether-fg outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commitDraft();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(null);
            }
          }}
          onBlur={() => {
            void commitDraft();
          }}
        />
      </div>
    ) : null;

  if (draft?.kind === "rename" && draft.targetPath === node.path) {
    return (
      <div
        className="flex items-center gap-1 py-0.5 pr-2"
        style={{ paddingLeft: 8 + depth * 12 + (node.kind === "file" ? 14 : 0) }}
      >
        <input
          ref={draftInputRef}
          defaultValue={draft.initial}
          className="h-6 w-full min-w-0 rounded border border-aether-accent bg-aether-bg px-1 text-xs text-aether-fg outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commitDraft();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(null);
            }
          }}
          onBlur={() => {
            void commitDraft();
          }}
        />
      </div>
    );
  }

  if (node.kind === "folder") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({
              x: e.clientX,
              y: e.clientY,
              path: node.path,
              kind: "folder",
              isRoot,
            });
          }}
          className="flex w-full items-center gap-1 py-0.5 pr-2 text-left text-xs text-aether-fg hover:bg-aether-surface-raised"
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Folder size={14} className="text-aether-fg-muted" />
          <span className="truncate">{node.name}</span>
        </button>
        {contextMenu}
        {open && (
          <>
            {draftRow}
            {(sketchFilter
              ? sortTreeForSketchMode(
                  filterTreeForSketchMode(node.children ?? [], false),
                )
              : node.children
            )?.map((child) => (
              <FileTreeNodeView
                key={child.path}
                node={child}
                depth={depth + 1}
                sketchFilter={sketchFilter}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  const isActive = activePath === node.path;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void openPathInEditor(node.path);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({
            x: e.clientX,
            y: e.clientY,
            path: node.path,
            kind: "file",
          });
        }}
        className={cn(
          "flex w-full items-center gap-1.5 py-0.5 pr-2 text-left text-xs hover:bg-aether-surface-raised",
          isActive ? "bg-aether-accent-muted text-aether-fg" : "text-aether-fg",
          isSecondary && sketchFilter && "opacity-70",
          isMain && sketchFilter && "font-medium",
        )}
        style={{ paddingLeft: 8 + depth * 12 + 14 }}
        title={node.path}
      >
        <FileCode2 size={14} className="shrink-0 text-aether-fg-muted" />
        <span className="truncate">{node.name}</span>
      </button>
      {contextMenu}
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-aether-surface-raised",
        danger ? "text-aether-danger" : "text-aether-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function FileTree({
  nodes,
  rootPath,
}: {
  nodes: FileTreeNode[];
  rootPath?: string;
}) {
  const createFile = useWorkspaceStore((s) => s.createFile);
  const createFolder = useWorkspaceStore((s) => s.createFolder);
  const sketchMode = useSettingsStore((s) => s.sketchMode);
  const showAllFiles = useSettingsStore((s) => s.showAllFiles);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const sketchFilter = sketchMode && isProject && !showAllFiles;
  const visibleNodes = sketchFilter
    ? sortTreeForSketchMode(filterTreeForSketchMode(nodes, false))
    : nodes;
  const [rootMenu, setRootMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    if (!rootMenu) return;
    const close = () => setRootMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [rootMenu]);

  if (nodes.length === 0 && !rootPath) {
    return (
      <p className="px-4 text-xs text-aether-fg-dim">This folder is empty.</p>
    );
  }

  return (
    <div
      className="min-h-[40px]"
      onContextMenu={
        rootPath
          ? (e) => {
              // Empty-area menu for root
              if ((e.target as HTMLElement).closest("button")) return;
              e.preventDefault();
              setRootMenu({
                x: e.clientX,
                y: e.clientY,
                path: rootPath,
                kind: "folder",
                isRoot: true,
              });
            }
          : undefined
      }
    >
      {visibleNodes.map((node) => (
        <FileTreeNodeView
          key={node.path}
          node={node}
          depth={0}
          sketchFilter={sketchFilter}
        />
      ))}
      {nodes.length === 0 && (
        <p className="px-4 py-2 text-xs text-aether-fg-dim">
          This folder is empty. Right-click to add files.
        </p>
      )}
      {rootMenu && rootPath && (
        <div
          className="fixed z-[80] min-w-[160px] rounded border border-aether-border bg-aether-surface py-1 shadow-xl"
          style={{ left: rootMenu.x, top: rootMenu.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem
            icon={<FilePlus size={13} />}
            label="New File…"
            onClick={() => {
              setRootMenu(null);
              const name = promptName("New file name", "untitled.cpp");
              if (name) void createFile(rootPath, name);
            }}
          />
          <MenuItem
            icon={<FolderPlus size={13} />}
            label="New Folder…"
            onClick={() => {
              setRootMenu(null);
              const name = promptName("New folder name", "src");
              if (name) void createFolder(rootPath, name);
            }}
          />
        </div>
      )}
    </div>
  );
}


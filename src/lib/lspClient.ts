import {
  isCppPath,
  languageIdForPath,
  lspNotify,
  lspPathToUri,
  lspRequest,
} from "@/lib/lsp";

const versions = new Map<string, number>();

export function resetLspDocuments(): void {
  versions.clear();
}

export async function lspInitialize(root: string): Promise<void> {
  const rootUri = await lspPathToUri(root);
  await lspRequest("initialize", {
    processId: null,
    rootUri,
    rootPath: root,
    workspaceFolders: [{ uri: rootUri, name: root.split(/[/\\]/).pop() ?? "workspace" }],
    capabilities: {
      textDocument: {
        synchronization: {
          didSave: true,
          willSave: false,
          willSaveWaitUntil: false,
          dynamicRegistration: false,
        },
        completion: {
          completionItem: {
            snippetSupport: false,
            documentationFormat: ["markdown", "plaintext"],
          },
          contextSupport: true,
        },
        hover: {
          contentFormat: ["markdown", "plaintext"],
        },
        definition: { linkSupport: true },
        publishDiagnostics: {
          relatedInformation: false,
          versionSupport: false,
        },
      },
      workspace: {
        workspaceFolders: true,
      },
    },
    initializationOptions: {
      clangdFileStatus: true,
    },
  });
  await lspNotify("initialized", {});
}

export async function lspDidOpen(
  path: string,
  text: string,
): Promise<void> {
  if (!isCppPath(path)) return;
  const uri = await lspPathToUri(path);
  const version = 1;
  versions.set(path, version);
  await lspNotify("textDocument/didOpen", {
    textDocument: {
      uri,
      languageId: languageIdForPath(path),
      version,
      text,
    },
  });
}

export async function lspDidChange(
  path: string,
  text: string,
): Promise<void> {
  if (!isCppPath(path)) return;
  if (!versions.has(path)) {
    await lspDidOpen(path, text);
    return;
  }
  const version = (versions.get(path) ?? 1) + 1;
  versions.set(path, version);
  const uri = await lspPathToUri(path);
  await lspNotify("textDocument/didChange", {
    textDocument: { uri, version },
    contentChanges: [{ text }],
  });
}

export async function lspDidClose(path: string): Promise<void> {
  if (!isCppPath(path)) return;
  if (!versions.has(path)) return;
  versions.delete(path);
  const uri = await lspPathToUri(path);
  await lspNotify("textDocument/didClose", {
    textDocument: { uri },
  });
}

export async function lspDidSave(path: string): Promise<void> {
  if (!isCppPath(path)) return;
  if (!versions.has(path)) return;
  const uri = await lspPathToUri(path);
  await lspNotify("textDocument/didSave", {
    textDocument: { uri },
  });
}

export function isLspDocOpen(path: string): boolean {
  return versions.has(path);
}

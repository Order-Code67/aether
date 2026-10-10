/**
 * Focus / stdin policy for Monaco, Search, and xterm so they don't steal
 * keystrokes from each other (WebView2 is sensitive to hidden textareas).
 */

export const FOCUS_SURFACE_ATTR = "data-aether-focus-surface";

export type FocusSurface = "search" | "terminal" | "editor" | "dialog";

/** CSS selectors that must remain user-selectable for typing. */
export const EDITABLE_USER_SELECT_SELECTORS = [
  "input",
  "textarea",
  "select",
  "option",
  '[contenteditable="true"]',
  ".monaco-editor",
  ".monaco-editor .view-lines",
  ".monaco-editor textarea",
  ".monaco-editor .inputarea",
  ".xterm",
  ".xterm textarea",
  ".xterm-helper-textarea",
] as const;

/**
 * Contract check for index.css: body must not forbid selection globally,
 * and editable surfaces must explicitly allow text selection.
 */
export function cssAllowsEditableUserSelect(cssSource: string): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  // Strip comments so advisory text like "Do NOT set user-select:none" is ignored.
  const withoutComments = cssSource.replace(/\/\*[\s\S]*?\*\//g, " ");
  const normalized = withoutComments.replace(/\s+/g, " ");

  // Flag bare `body { ... user-select: none }` (not .aether-no-select / body.foo).
  const bodyBlock = normalized.match(/(?:^|[^{}])\s*body\s*\{([^}]*)\}/);
  if (bodyBlock?.[1] && /user-select\s*:\s*none/i.test(bodyBlock[1])) {
    reasons.push("body sets user-select:none (breaks Monaco/WebView2 typing)");
  }

  const hasEditableAllow =
    /\.monaco-editor[\s\S]*?user-select\s*:\s*text/i.test(withoutComments) &&
    /\.xterm[\s\S]*?user-select\s*:\s*text/i.test(withoutComments) &&
    /\binput\b[\s\S]*?user-select\s*:\s*text/i.test(withoutComments);

  if (!hasEditableAllow) {
    reasons.push(
      "editable surfaces (input/monaco/xterm) must set user-select:text",
    );
  }

  return { ok: reasons.length === 0, reasons };
}

/** Enable/disable xterm helper textarea so hidden terminals cannot keep focus. */
export function applyXtermStdinEnabled(
  host: HTMLElement | null,
  enabled: boolean,
): void {
  const textarea = host?.querySelector(
    "textarea.xterm-helper-textarea",
  ) as HTMLTextAreaElement | null;
  if (!textarea) return;
  if (enabled) {
    textarea.readOnly = false;
    textarea.tabIndex = 0;
  } else {
    textarea.readOnly = true;
    textarea.tabIndex = -1;
    textarea.blur();
  }
}

export type TerminalFocusOptions = {
  disableStdin: boolean;
};

/** Pure policy: inactive terminal ⇒ stdin off / not focusable. */
export function terminalFocusOptions(active: boolean): TerminalFocusOptions {
  return { disableStdin: !active };
}

export function isInsideFocusSurface(
  el: Element | null,
  surface: FocusSurface,
): boolean {
  if (!el || !(el instanceof Element)) return false;
  return Boolean(el.closest(`[${FOCUS_SURFACE_ATTR}="${surface}"]`));
}

export function isTypingTarget(el: Element | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  if (isInsideFocusSurface(el, "search")) return true;
  if (isInsideFocusSurface(el, "dialog")) return true;
  if (el.closest(".xterm")) return true;
  // Monaco uses a textarea; treat it as the editor, not a chrome typing target.
  if (el.closest(".monaco-editor")) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  return false;
}

/**
 * Monaco should not yank focus away from Search / Terminal / dialogs
 * on tab activation or mount timers.
 */
export function shouldMonacoClaimFocus(
  activeElement: Element | null = typeof document !== "undefined"
    ? document.activeElement
    : null,
): boolean {
  if (!activeElement || activeElement === document.body) return true;
  if (isTypingTarget(activeElement)) return false;
  // Already in Monaco — fine to re-focus.
  if (activeElement.closest(".monaco-editor")) return true;
  return true;
}

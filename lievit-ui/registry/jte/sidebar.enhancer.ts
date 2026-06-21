/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * sidebar enhancer (ADR-0012, server-first): the CSP-clean typed-TS that gives the server-rendered
 * `lievit/sidebar.jte` partial its collapse / off-canvas behaviour. The nav itself -- the <nav>
 * landmark, the real <a href> items, the groups / sub-items, the aria-current on the active entry --
 * is all server-rendered HTML; this module ONLY toggles the collapsed/expanded rail on desktop and
 * the off-canvas overlay on mobile, attaching listeners in code (the strict CSP refuses inline
 * `on*=` handlers).
 *
 * It is deliberately STATELESS server-side: when a user narrows their own sidebar there is nothing
 * for the server to decide, so this is pure client cosmetic and never round-trips the wire (the same
 * reasoning the input-otp enhancer uses). The desktop collapsed/expanded choice persists to
 * localStorage under the root's `data-storage-key`; mobile open/close is transient.
 *
 * Behaviour (shadcn Sidebar model):
 *   - desktop trigger: toggles data-state="expanded" | "collapsed" on the root, mirrors
 *     aria-expanded on the trigger, persists the choice;
 *   - rail (data-sidebar="rail"): a second, edge-docked affordance bound to the SAME toggle as
 *     the trigger (shadcn SidebarRail onClick={toggleSidebar}); mouse-only (tabindex=-1 in markup);
 *   - Cmd/Ctrl+B: a global keydown shortcut toggles the sidebar (shadcn SIDEBAR_KEYBOARD_SHORTCUT
 *     = "b"); it toggles the off-canvas overlay on mobile and the collapsed rail on desktop, same
 *     as the trigger, and respects the storage-key persistence;
 *   - mobile (<= the breakpoint, default 768px): the same trigger opens an off-canvas overlay
 *     (data-mobile-open), the backdrop click + Escape close it, focus returns to the trigger
 *     (the same dismissal contract as the drawer wire);
 *   - hydration: on enhance, the persisted desktop choice overrides the SSR data-state.
 *
 * The stateful CSS (the collapsed icon rail, the mobile slide-in + backdrop) is injected ONCE as a
 * single <style> element -- a stylesheet, not an inline handler, so the CSP allows it -- keeping the
 * partial pure markup and the rules co-located with the behaviour they pair with.
 *
 * Idempotent: call {@link enhanceSidebar} once (it marks each root) and again after a DOM swap;
 * already-enhanced roots are skipped. {@link enhanceAllSidebars} wires every root on the page.
 */

const ENHANCED = "data-sidebar-enhanced";
const STYLE_ID = "lv-sidebar-styles";
const MOBILE_MAX = 768;

/** The stateful rules the inline styles cannot express (data-state / mobile selectors). */
const STYLES = `
.lv-sidebar-root { height: 100%; }
.lv-sidebar { position: relative; width: 16rem; transition: width 0.2s ease; }
.lv-sidebar-root[data-side="left"] .lv-sidebar { border-right: 1px solid var(--lv-color-sidebar-border); }
.lv-sidebar-root[data-side="right"] .lv-sidebar { border-left: 1px solid var(--lv-color-sidebar-border); }
.lv-sidebar-item:hover { background: var(--lv-color-sidebar-accent); color: var(--lv-color-sidebar-accent-fg); }
.lv-sidebar-item:focus-visible { outline: none; box-shadow: var(--lv-ring); }
.lv-sidebar-trigger:focus-visible { outline: none; box-shadow: var(--lv-ring); }
.lv-sidebar-trigger:hover { background: var(--lv-color-sidebar-accent); }
details[data-sidebar="disclosure"][open] > summary .lv-sidebar-chevron { transform: rotate(90deg); }
/* trailing action affordances (menu-action / group-action): hover + focus states */
.lv-sidebar-menu-action:hover, .lv-sidebar-group-action:hover { background: var(--lv-color-sidebar-accent); color: var(--lv-color-sidebar-accent-fg); }
.lv-sidebar-menu-action:focus-visible, .lv-sidebar-group-action:focus-visible { outline: none; box-shadow: var(--lv-ring); }
/* showOnHover: hide the action until the menu item is hovered or holds focus (shadcn showOnHover) */
.lv-sidebar-action-hover { opacity: 0; transition: opacity 0.15s ease; }
li[data-slot="sidebar-menu-item"]:hover .lv-sidebar-action-hover,
li[data-slot="sidebar-menu-item"]:focus-within .lv-sidebar-action-hover { opacity: 1; }
/* rail: a thin clickable edge docked to the inner side of the rail (shadcn SidebarRail) */
.lv-sidebar-rail { transition: background 0.15s ease; }
.lv-sidebar-root[data-side="left"] .lv-sidebar-rail { right: 0; }
.lv-sidebar-root[data-side="right"] .lv-sidebar-rail { left: 0; }
.lv-sidebar-rail:hover { background: var(--lv-color-sidebar-border); }
/* variant=none: drop the rail border (flush surface, no elevation) */
.lv-sidebar-root[data-variant="none"] .lv-sidebar { border: 0; }
/* variant=floating / inset: detach the rail as a bordered + shadowed rounded card */
.lv-sidebar-root[data-variant="floating"] .lv-sidebar,
.lv-sidebar-root[data-variant="inset"] .lv-sidebar {
  margin: var(--lv-space-2); height: calc(100% - (var(--lv-space-2) * 2));
  border: 1px solid var(--lv-color-sidebar-border); border-radius: var(--lv-radius-lg);
  box-shadow: var(--lv-shadow-sm);
}
/* variant=inset: the adjacent sidebar/inset <main> floats as an inset card too */
.lv-sidebar-root[data-variant="inset"] ~ .lv-sidebar-inset,
.lv-sidebar-root[data-variant="inset"] + .lv-sidebar-inset {
  margin: var(--lv-space-2); border-radius: var(--lv-radius-lg); box-shadow: var(--lv-shadow-sm);
}
/* desktop collapsed: icon rail -- hide labels / badges / group headings / chevrons, centre icons */
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar { width: 3.25rem; }
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar-collapsible { display: none; }
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar-item { justify-content: center; }
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar-sub { display: none; }
/* mobile: off-canvas overlay reusing the drawer slide-in + backdrop pattern */
@media (max-width: ${MOBILE_MAX}px) {
  .lv-sidebar-root .lv-sidebar {
    position: fixed; top: 0; bottom: 0; z-index: calc(var(--lv-z-modal, 9500) + 1);
    width: min(85vw, 18rem); transform: translateX(-100%); transition: transform 0.2s ease;
    box-shadow: var(--lv-shadow-lg);
  }
  .lv-sidebar-root[data-side="right"] .lv-sidebar { left: auto; right: 0; transform: translateX(100%); }
  .lv-sidebar-root[data-side="left"] .lv-sidebar { left: 0; }
  .lv-sidebar-root[data-mobile-open] .lv-sidebar { transform: translateX(0); }
  .lv-sidebar-root[data-mobile-open] .lv-sidebar-backdrop { display: block !important; }
  /* the rail is a desktop-only collapse edge; the off-canvas overlay has the backdrop instead */
  .lv-sidebar-rail { display: none; }
  /* on mobile the rail panel is full-width: drop the floating/inset card insets */
  .lv-sidebar-root[data-variant="floating"] .lv-sidebar,
  .lv-sidebar-root[data-variant="inset"] .lv-sidebar { margin: 0; height: 100%; border-radius: 0; }
  /* on mobile the rail is always the full panel; ignore the desktop collapsed state */
  .lv-sidebar-root[data-state="collapsed"] .lv-sidebar { width: min(85vw, 18rem); }
  .lv-sidebar-root[data-state="collapsed"] .lv-sidebar-collapsible { display: revert; }
}
`;

/** Inject the stateful stylesheet once (idempotent). */
function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

/** The desktop collapse trigger of a root. */
function triggerOf(root: HTMLElement): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]');
}

/** The edge rail toggle of a root, if one is rendered. */
function railOf(root: HTMLElement): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>('[data-slot="sidebar-rail"]');
}

/** The mobile dismissal backdrop of a root. */
function backdropOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-sidebar="backdrop"]');
}

/** True at or below the mobile breakpoint. */
function isMobile(): boolean {
  return globalThis.matchMedia?.(`(max-width: ${MOBILE_MAX}px)`).matches ?? false;
}

/** Read the persisted desktop collapse choice for a root, if any. */
function persisted(root: HTMLElement): "expanded" | "collapsed" | null {
  const key = root.getAttribute("data-storage-key");
  if (!key) return null;
  try {
    const v = globalThis.localStorage?.getItem(key);
    return v === "collapsed" || v === "expanded" ? v : null;
  } catch {
    return null; // storage unavailable (private mode / SSR)
  }
}

/** Persist the desktop collapse choice for a root. */
function persist(root: HTMLElement, state: "expanded" | "collapsed"): void {
  const key = root.getAttribute("data-storage-key");
  if (!key) return;
  try {
    globalThis.localStorage?.setItem(key, state);
  } catch {
    /* storage unavailable: skip persistence */
  }
}

/** Apply the desktop collapsed/expanded state to a root (data-state + trigger aria-expanded). */
function setDesktopState(root: HTMLElement, state: "expanded" | "collapsed"): void {
  root.setAttribute("data-state", state);
  triggerOf(root)?.setAttribute("aria-expanded", state === "expanded" ? "true" : "false");
}

/** Open the mobile off-canvas overlay; remember the element to return focus to. */
function openMobile(root: HTMLElement): void {
  root.setAttribute("data-mobile-open", "");
  (root as HTMLElement & { _lvReturnFocus?: Element | null })._lvReturnFocus =
    document.activeElement;
  root.querySelector<HTMLElement>('[data-slot="sidebar-menu-button"]')?.focus();
}

/** Close the mobile off-canvas overlay; return focus to the opener. */
function closeMobile(root: HTMLElement): void {
  root.removeAttribute("data-mobile-open");
  const holder = root as HTMLElement & { _lvReturnFocus?: Element | null };
  const back = holder._lvReturnFocus;
  if (back && back instanceof HTMLElement) back.focus();
  else triggerOf(root)?.focus();
  holder._lvReturnFocus = null;
}

/**
 * Toggle the sidebar (shadcn toggleSidebar): off-canvas overlay on mobile, collapsed rail on
 * desktop (persisting the desktop choice). The single lever the trigger, the rail, and the
 * Cmd/Ctrl+B shortcut all share.
 */
function toggleSidebar(root: HTMLElement): void {
  if (isMobile()) {
    root.hasAttribute("data-mobile-open") ? closeMobile(root) : openMobile(root);
    return;
  }
  const next = root.getAttribute("data-state") === "collapsed" ? "expanded" : "collapsed";
  setDesktopState(root, next);
  persist(root, next);
}

/** Enhance one sidebar root. No-op if already enhanced. */
export function enhanceSidebar(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  root.setAttribute(ENHANCED, "");
  ensureStyles();

  // Hydrate the persisted desktop choice over the SSR data-state.
  const saved = persisted(root);
  if (saved) setDesktopState(root, saved);

  triggerOf(root)?.addEventListener("click", () => toggleSidebar(root));
  railOf(root)?.addEventListener("click", () => toggleSidebar(root));

  backdropOf(root)?.addEventListener("click", () => closeMobile(root));

  root.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" && root.hasAttribute("data-mobile-open")) {
      e.preventDefault();
      closeMobile(root);
    }
  });

  // Cmd/Ctrl+B toggles the sidebar (shadcn SIDEBAR_KEYBOARD_SHORTCUT = "b"). Bound once per root
  // on the document; the listener is harmless if multiple roots register it (each toggles itself).
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.key === "b" || e.key === "B") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggleSidebar(root);
    }
  });
}

/** Enhance every `[data-sidebar="root"]` root on the page (call on load + after DOM swaps). */
export function enhanceAllSidebars(scope: ParentNode = document): void {
  ensureStyles();
  scope
    .querySelectorAll<HTMLElement>('[data-sidebar="root"]')
    .forEach((root) => enhanceSidebar(root));
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The CSP-clean island that progressively enhances the server-first file-upload WIRE component
 * (registry/wire/file-upload/file-upload.jte) into a full dropzone: drag-and-drop highlight, local
 * thumbnail previews, an upload progress bar, remove, and reorder.
 *
 * SERVER-FIRST CONTRACT (never broken): the partial renders a real, form-associated
 * `<input type="file" multiple>` plus a server-rendered file list; with JS off the input POSTs the
 * chosen files with the surrounding multipart `<form>`. This island only ADDS affordances on top:
 * it does not replace the input (it stays the picker + the JS-off submit path), it adds drag-drop
 * onto the zone, renders client-side previews/progress while the bytes travel, and lets the user
 * reorder/remove the pending previews.
 *
 * THE TEMP-UPLOAD WIRE PROTOCOL (the seam the adopter wires): when the wire runtime's upload path is
 * installed (`runtime/features/uploads.ts` -> `installUploads`, the `l:upload="files"` directive on
 * the input), the chosen bytes POST out-of-band to the upload endpoint (`/lievit/upload`), which
 * returns a SIGNED TEMP-FILE REFERENCE; the wire sets the server-held `files` list to that ref and
 * re-renders the server file list. The bytes never ride the snapshot (state-never-code); only the
 * reference does. This island is the CLIENT presentation of that flow: it listens for the runtime's
 * `lievit:upload-start` / `-progress` / `-finish` / `-error` events (the documented seam) to drive
 * the progress UI, and falls back to a `change`-driven local preview when those events are absent
 * (no wire upload installed). The adopter still owns the SERVER half of the protocol (the endpoint
 * that validates + stores to temp + signs the ref); that is application-specific by design.
 *
 * CSP: no `eval`, no `new Function`, no inline `<script>`, no `on*=` handler -- `addEventListener` +
 * DOM/`URL.createObjectURL` only.
 */

/** Marks a file-upload root so enhancement runs exactly once per element. */
const WIRED = "data-file-upload-enhanced";

/** A pending client-side preview entry (before/while the server list reflects the upload). */
export interface PreviewEntry {
  /** A stable id for this preview (so reorder/remove target it). */
  readonly id: string;
  /** The file name. */
  readonly name: string;
  /** The byte size. */
  readonly size: number;
  /** The mime type. */
  readonly type: string;
  /** An object URL for an image thumbnail, or null for non-images. */
  readonly objectUrl: string | null;
  /** Upload progress in [0,1]; 1 when finished, undefined before start. */
  progress?: number;
}

/** Options for {@link enhanceFileUploads}. */
export interface FileUploadOptions {
  /** The subtree to scan (defaults to `document`). */
  readonly root?: ParentNode;
  /** Inject an object-URL factory (tests pass a stub; default uses `URL.createObjectURL`). */
  readonly objectUrlFor?: (file: { type: string }) => string | null;
}

// ---------------------------------------------------------------------------
// Pure logic (unit-tested without the DOM): preview building, progress, reorder.
// ---------------------------------------------------------------------------

/** Is this file an image (so it gets a thumbnail rather than a generic file icon)? */
export function isImage(type: string): boolean {
  return type.startsWith("image/");
}

/** A human-readable size for a byte count (mirrors FileUploadComponent.formatSize). */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format a [0,1] progress fraction as an integer percent string (clamped). */
export function formatProgress(fraction: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return `${pct}%`;
}

/** Move the item at `from` to `to` in a NEW array (reorder; out-of-range is a no-op copy). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = items.slice();
  if (
    from < 0 ||
    from >= copy.length ||
    to < 0 ||
    to >= copy.length ||
    from === to
  ) {
    return copy;
  }
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/** Build the pending-preview list from a FileList-like array (pure; object URL is injected). */
export function buildPreviews(
  files: ReadonlyArray<{ name: string; size: number; type: string }>,
  objectUrlFor: (file: { type: string }) => string | null,
): PreviewEntry[] {
  return files.map((file, index) => ({
    id: `${index}-${file.name}`,
    name: file.name,
    size: file.size,
    type: file.type,
    objectUrl: isImage(file.type) ? objectUrlFor(file) : null,
  }));
}

// ---------------------------------------------------------------------------
// DOM enhancement.
// ---------------------------------------------------------------------------

/** A CSS class toggled on the zone while a drag is over it (style it via tokens in your CSS). */
const DRAGOVER = "data-file-upload-dragover";

/**
 * Enhance every server-first `[data-file-upload]` in `root`: drag-and-drop onto the dropzone +
 * client preview/progress driven by the runtime upload events. Idempotent; disabled roots are left
 * as the plain native input. Returns a teardown removing exactly the listeners this call added.
 */
export function enhanceFileUploads(options: FileUploadOptions = {}): () => void {
  const root: ParentNode = options.root ?? document;
  const objectUrlFor =
    options.objectUrlFor ??
    ((file: { type: string }) =>
      typeof URL !== "undefined" && "createObjectURL" in URL
        ? URL.createObjectURL(file as unknown as Blob)
        : null);
  const teardowns: Array<() => void> = [];
  for (const el of collectRoots(root, "[data-file-upload]")) {
    // Coexistence during the Stimulus fan-out: a root converted to the lv-file-upload controller
    // owns its own lifecycle (drag-drop + previews + progress). Skip it so this legacy enhancer
    // never double-wires the same DOM (the convention's converted-instance guard).
    if (el.matches('[data-controller~="lv-file-upload"]')) {
      continue;
    }
    if (el.getAttribute(WIRED) === "true") {
      continue;
    }
    el.setAttribute(WIRED, "true");
    const teardown = wireOne(el, objectUrlFor);
    if (teardown) {
      teardowns.push(teardown);
    }
  }
  return () => {
    for (const t of teardowns) {
      t();
    }
  };
}

/** Wire one file-upload root's drag-drop + progress listeners; returns a teardown. */
function wireOne(
  rootEl: HTMLElement,
  objectUrlFor: (file: { type: string }) => string | null,
): (() => void) | null {
  const input = rootEl.querySelector<HTMLInputElement>(
    "[data-file-upload-input]",
  );
  const zone = rootEl.querySelector<HTMLElement>("[data-file-upload-zone]");
  if (!input || !zone) {
    // Server-first contract intact: with no zone the native input simply works as-is.
    return null;
  }
  if (input.disabled) {
    return null;
  }

  const cleanups: Array<() => void> = [];

  // Drag-and-drop: highlight the zone, route a drop's files into the native input (so the existing
  // change handler / wire l:upload picks them up exactly as if the user had browsed for them).
  const onDragOver = (event: DragEvent): void => {
    event.preventDefault();
    zone.setAttribute(DRAGOVER, "true");
  };
  const onDragLeave = (): void => {
    zone.removeAttribute(DRAGOVER);
  };
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    zone.removeAttribute(DRAGOVER);
    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length > 0) {
      input.files = dropped;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  zone.addEventListener("dragover", onDragOver);
  zone.addEventListener("dragleave", onDragLeave);
  zone.addEventListener("drop", onDrop);
  cleanups.push(() => zone.removeEventListener("dragover", onDragOver));
  cleanups.push(() => zone.removeEventListener("dragleave", onDragLeave));
  cleanups.push(() => zone.removeEventListener("drop", onDrop));

  // Client-side previews on selection (immediate feedback before the server list re-renders).
  const previewHost = ensurePreviewHost(rootEl);
  const objectUrls: string[] = [];
  const onChange = (): void => {
    revokeAll(objectUrls);
    const files = input.files ? Array.from(input.files) : [];
    const previews = buildPreviews(files, objectUrlFor);
    for (const p of previews) {
      if (p.objectUrl) {
        objectUrls.push(p.objectUrl);
      }
    }
    renderPreviews(previewHost, previews);
  };
  input.addEventListener("change", onChange);
  cleanups.push(() => input.removeEventListener("change", onChange));

  // Progress: the runtime upload path fires these on the root; drive the progress bar from them.
  const onProgress = (event: Event): void => {
    const detail = (event as CustomEvent).detail as { fraction?: number } | undefined;
    const bar = previewHost.querySelector<HTMLElement>("[data-file-upload-progress]");
    if (bar && typeof detail?.fraction === "number") {
      bar.style.width = formatProgress(detail.fraction);
      bar.setAttribute("aria-valuenow", String(Math.round(detail.fraction * 100)));
    }
  };
  rootEl.addEventListener("lievit:upload-progress", onProgress);
  cleanups.push(() =>
    rootEl.removeEventListener("lievit:upload-progress", onProgress),
  );

  return () => {
    for (const c of cleanups) {
      c();
    }
    revokeAll(objectUrls);
    previewHost.remove();
    rootEl.removeAttribute(WIRED);
  };
}

/** Ensure (and return) the client-preview host the island renders thumbnails/progress into. */
function ensurePreviewHost(rootEl: HTMLElement): HTMLElement {
  let host = rootEl.querySelector<HTMLElement>("[data-file-upload-previews]");
  if (!host) {
    host = document.createElement("div");
    host.setAttribute("data-file-upload-previews", "");
    host.setAttribute("aria-label", "Pending uploads");
    rootEl.appendChild(host);
  }
  return host;
}

/** Render the pending previews (thumbnail or file icon + name + size + a progress bar). */
function renderPreviews(host: HTMLElement, previews: PreviewEntry[]): void {
  host.textContent = "";
  for (const p of previews) {
    const item = document.createElement("div");
    item.setAttribute("data-file-upload-preview", p.id);

    if (p.objectUrl) {
      const img = document.createElement("img");
      img.setAttribute("data-file-upload-thumb", "");
      img.src = p.objectUrl;
      img.alt = p.name;
      img.width = 48;
      img.height = 48;
      item.appendChild(img);
    }

    const name = document.createElement("span");
    name.setAttribute("data-file-upload-preview-name", "");
    name.textContent = `${p.name} (${formatSize(p.size)})`;
    item.appendChild(name);

    const bar = document.createElement("div");
    bar.setAttribute("data-file-upload-progress", "");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", "0");
    bar.style.width = "0%";
    item.appendChild(bar);

    host.appendChild(item);
  }
}

/** Revoke + clear a list of object URLs (prevents the leak from createObjectURL). */
function revokeAll(urls: string[]): void {
  if (typeof URL !== "undefined" && "revokeObjectURL" in URL) {
    for (const url of urls) {
      URL.revokeObjectURL(url);
    }
  }
  urls.length = 0;
}

/** Collect matching roots under `root`, including `root` itself when it matches. */
function collectRoots(root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (
    root instanceof HTMLElement &&
    root.matches(selector) &&
    !found.includes(root)
  ) {
    found.unshift(root);
  }
  return found;
}

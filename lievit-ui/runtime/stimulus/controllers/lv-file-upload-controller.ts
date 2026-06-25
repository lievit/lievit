/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-file-upload` -- the progressive-enhancement island for the server-first file-upload WIRE
 * component (registry/wire/file-upload/file-upload.jte), as a Stimulus controller (the conversion of
 * the hand-rolled `enhanceFileUploads` enhancer in registry/wire/file-upload/file-upload.ts, which
 * carried the `data-file-upload-enhanced` marker + a manual teardown sweep). Mounted ON THE ROOT via
 * `data-controller="lv-file-upload"`; the root already carries the established server contract
 * (`data-file-upload`, the visually-hidden `[data-file-upload-input]`, the `[data-file-upload-zone]`
 * dropzone label).
 *
 * What it ADDS on top of the server-first markup (never replacing it -- the native input stays the
 * picker and the JS-off submit path):
 * 1. **drag-and-drop**: highlight the zone on dragover (`data-file-upload-dragover`), clear on
 *    dragleave, and on drop route the dropped files into the native input + fire `change` (so the
 *    wire `l:upload` directive and this preview path pick them up exactly as a browse would).
 * 2. **client previews on selection**: an image thumbnail (object URL) + name + size + a progress
 *    bar per file, rendered into a `[data-file-upload-previews]` host the controller owns.
 * 3. **progress**: the wire upload path (runtime/features/uploads.ts) fires `lievit:upload-progress`
 *    on the input; it bubbles to this root, where the controller drives the first progress bar.
 *
 * This controller NEVER talks to the wire: the transport + `setModel` stay in the `l:upload`
 * directive (uploads.ts), which this UI only LISTENS to via the `lievit:upload-*` events. It is not
 * a dismissable surface, so it extends the plain {@link Controller} (no controlled/uncontrolled
 * close, no focus trap): the controlled/uncontrolled doctrine is preserved precisely by issuing ZERO
 * wire round-trips from here.
 *
 * Morph-safety: every listener is declared as a `data-action` in the template, so Stimulus re-binds
 * it automatically across the lievit wire morph + idiomorph + Turbo Drive, and tears it down when the
 * root leaves the DOM. No `data-file-upload-enhanced` marker, no WeakSet, no manual teardown sweep --
 * Stimulus owns connect/disconnect. `disconnect()` only revokes the object URLs this controller
 * created (the createObjectURL leak guard) and drops its preview host.
 *
 * CSP: `addEventListener`/`data-action` + DOM/`URL.createObjectURL` only -- no eval, no inline script.
 */

import { Controller } from "@hotwired/stimulus";

/** The attribute toggled on the dropzone while a drag is over it (style it via tokens in CSS). */
const DRAGOVER = "data-file-upload-dragover";
/** The client-preview host the controller renders thumbnails/progress into. */
const PREVIEWS = "data-file-upload-previews";
/** The per-file progress bar the wire upload-progress events drive. */
const PROGRESS = "data-file-upload-progress";

/** Is this file an image (so it gets a thumbnail rather than a generic file row)? */
function isImage(type: string): boolean {
  return type.startsWith("image/");
}

/** A human-readable size for a byte count (mirrors FileUploadComponent.formatSize / the server). */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format a [0,1] progress fraction as a clamped integer-percent string. */
function formatProgress(fraction: number): string {
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}

export default class LvFileUploadController extends Controller<HTMLElement> {
  static targets = ["input", "zone"];

  declare readonly hasInputTarget: boolean;
  declare readonly inputTarget: HTMLInputElement;
  declare readonly hasZoneTarget: boolean;
  declare readonly zoneTarget: HTMLElement;

  /** Object URLs created for image thumbnails; revoked on re-render + disconnect (leak guard). */
  private objectUrls: string[] = [];

  disconnect(): void {
    // Stimulus tears the data-action listeners down for us; we only release the resources this
    // controller allocated: the object URLs (else they leak) + the client-only preview host.
    this.revokeUrls();
    this.element.querySelector(`[${PREVIEWS}]`)?.remove();
  }

  /** True when the server rendered the control disabled: leave it the plain native input. */
  private get isDisabled(): boolean {
    return this.hasInputTarget && this.inputTarget.disabled;
  }

  /** dragover -> highlight the zone (and allow the drop by preventing the default). */
  dragOver(event: DragEvent): void {
    if (this.isDisabled || !this.hasZoneTarget) {
      return;
    }
    event.preventDefault();
    this.zoneTarget.setAttribute(DRAGOVER, "true");
  }

  /** dragleave -> clear the highlight. */
  dragLeave(): void {
    if (!this.hasZoneTarget) {
      return;
    }
    this.zoneTarget.removeAttribute(DRAGOVER);
  }

  /** drop -> clear the highlight + route the dropped files into the native input as a browse. */
  drop(event: DragEvent): void {
    if (this.isDisabled || !this.hasInputTarget || !this.hasZoneTarget) {
      return;
    }
    event.preventDefault();
    this.zoneTarget.removeAttribute(DRAGOVER);
    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length > 0) {
      this.inputTarget.files = dropped;
      this.inputTarget.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /** change -> render the client-side previews for immediate feedback before the server re-renders. */
  change(): void {
    if (this.isDisabled || !this.hasInputTarget) {
      return;
    }
    this.revokeUrls();
    const files = this.inputTarget.files ? Array.from(this.inputTarget.files) : [];
    this.renderPreviews(files);
  }

  /** lievit:upload-progress (bubbled from the input) -> drive the progress bar width + aria-valuenow. */
  progress(event: Event): void {
    if (this.isDisabled) {
      return;
    }
    const detail = (event as CustomEvent).detail as { fraction?: number } | undefined;
    const bar = this.element.querySelector<HTMLElement>(`[${PROGRESS}]`);
    if (bar != null && typeof detail?.fraction === "number") {
      bar.style.width = formatProgress(detail.fraction);
      bar.setAttribute("aria-valuenow", String(Math.round(detail.fraction * 100)));
    }
  }

  /** An object URL for an image thumbnail (tracked for revocation), or null for non-images. */
  private objectUrlFor(file: File): string | null {
    if (!isImage(file.type)) {
      return null;
    }
    if (typeof URL === "undefined" || !("createObjectURL" in URL)) {
      return null;
    }
    const url = URL.createObjectURL(file);
    this.objectUrls.push(url);
    return url;
  }

  /** Ensure (and return) the client-preview host, querying first so a morph never duplicates it. */
  private ensureHost(): HTMLElement {
    let host = this.element.querySelector<HTMLElement>(`[${PREVIEWS}]`);
    if (host == null) {
      host = document.createElement("div");
      host.setAttribute(PREVIEWS, "");
      host.setAttribute("aria-label", "Pending uploads");
      this.element.appendChild(host);
    }
    return host;
  }

  /** Render the pending previews (thumbnail-or-nothing + name + size + a progress bar) into the host. */
  private renderPreviews(files: readonly File[]): void {
    const host = this.ensureHost();
    host.textContent = "";
    files.forEach((file, index) => {
      const objectUrl = this.objectUrlFor(file);

      const item = document.createElement("div");
      item.setAttribute("data-file-upload-preview", `${index}-${file.name}`);

      if (objectUrl != null) {
        const img = document.createElement("img");
        img.setAttribute("data-file-upload-thumb", "");
        img.src = objectUrl;
        img.alt = file.name;
        img.width = 48;
        img.height = 48;
        item.appendChild(img);
      }

      const name = document.createElement("span");
      name.setAttribute("data-file-upload-preview-name", "");
      name.textContent = `${file.name} (${formatSize(file.size)})`;
      item.appendChild(name);

      const bar = document.createElement("div");
      bar.setAttribute(PROGRESS, "");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-valuenow", "0");
      bar.style.width = "0%";
      item.appendChild(bar);

      host.appendChild(item);
    });
  }

  /** Revoke + clear the tracked object URLs (prevents the createObjectURL leak). */
  private revokeUrls(): void {
    if (typeof URL !== "undefined" && "revokeObjectURL" in URL) {
      for (const url of this.objectUrls) {
        URL.revokeObjectURL(url);
      }
    }
    this.objectUrls = [];
  }
}

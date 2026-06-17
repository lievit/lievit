/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * A selected file entry surfaced by `<lv-file-upload>`.
 */
export interface UploadFile {
  name: string;
  size: number;
  type: string;
}

/**
 * `<lv-file-upload>`: a drag-and-drop file uploader (UI only; wire to backend is out of scope).
 *
 * Accessibility (WAI-ARIA, research 4.3):
 * - The drop zone carries `role="button"`, `aria-label`, `tabindex="0"` and responds to
 *   Enter/Space to open the file picker (same activation as a button, APG pattern).
 * - `aria-describedby` links the drop zone to the constraint hint.
 * - An `aria-live="polite"` region announces the selected file list to assistive tech.
 * - The native `<input type="file">` is visually hidden but reachable by the opener.
 * - Each file entry has a labeled remove button (`aria-label="Remove <name>"`).
 *
 * Data down, events up:
 * - Emits `lv-files-change` with the current `UploadFile[]` whenever the selection changes.
 * - The component does NOT submit files; that is the adopter's responsibility.
 *
 * Supports `accept`, `multiple`, and a drag-over visual state.
 * No new heavy JS deps: drag-drop is native DOM, no `@floating-ui/dom` needed.
 *
 * Owned source, copied in by `lievit add file-upload`. Light-DOM rendered.
 */
@customElement("lv-file-upload")
export class LvFileUpload extends LitElement {
  /** Comma-separated MIME types or extensions (forwarded to the native input). */
  @property() accept = "";

  /** Allow multiple file selection. */
  @property({ type: Boolean }) multiple = false;

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** Primary label inside the drop zone. */
  @property() dropLabel = "Drop files here or click to browse";

  /** Constraint hint shown below the label (e.g. "PDF, max 10 MB"). */
  @property() hint = "";

  /** Accessible label for the drop zone button. */
  @property() label = "File upload";

  @state() private files: UploadFile[] = [];
  @state() private dragOver = false;

  private static seq = 0;
  private readonly inputId = `lv-file-input-${LvFileUpload.seq++}`;
  private readonly hintId = `lv-file-hint-${LvFileUpload.seq}`;
  private readonly liveId = `lv-file-live-${LvFileUpload.seq}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-file-upload", LvFileUpload.css);
    return this;
  }

  static readonly css = `
    .lv-file-upload { display: block; }
    .lv-file-upload__input { display: none; }
    .lv-file-upload__zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--lv-space-2);
      padding: var(--lv-space-5) var(--lv-space-4);
      border: 2px dashed var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      background: var(--lv-color-surface);
      cursor: pointer;
      text-align: center;
      transition: border-color 150ms ease, background 150ms ease;
    }
    .lv-file-upload__zone:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-file-upload__zone--dragover {
      border-color: var(--lv-color-primary);
      background: color-mix(in srgb, var(--lv-color-primary) 8%, var(--lv-color-bg));
    }
    .lv-file-upload__zone--disabled { opacity: 0.5; cursor: not-allowed; }
    .lv-file-upload__icon {
      font-size: 1.75rem;
      color: var(--lv-color-muted);
    }
    .lv-file-upload__drop-label {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
    }
    .lv-file-upload__hint {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-muted);
    }
    .lv-file-upload__list {
      list-style: none;
      padding: 0;
      margin: var(--lv-space-2) 0 0;
      display: flex;
      flex-direction: column;
      gap: var(--lv-space-1);
    }
    .lv-file-upload__item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--lv-space-2) var(--lv-space-3);
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
    }
    .lv-file-upload__item-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lv-file-upload__item-size {
      color: var(--lv-color-muted);
      margin: 0 var(--lv-space-2);
      white-space: nowrap;
    }
    .lv-file-upload__remove {
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--lv-color-muted);
      font-size: var(--lv-text-sm);
      padding: 0 var(--lv-space-1);
      line-height: 1;
    }
    .lv-file-upload__remove:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-file-upload__remove:hover { color: var(--lv-color-danger); }
    .lv-file-upload__live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  `;

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private openPicker() {
    if (this.disabled) return;
    (this.querySelector(`#${this.inputId}`) as HTMLInputElement | null)?.click();
  }

  private onInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files) return;
    this.addFiles(input.files);
    input.value = "";
  }

  /** Programmatically add files; useful for testing and server-side pre-population. */
  addFiles(fileList: FileList) {
    const incoming: UploadFile[] = Array.from(fileList).map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    this.files = this.multiple
      ? [...this.files, ...incoming.filter((n) => !this.files.some((e) => e.name === n.name))]
      : incoming.slice(0, 1);
    this.emitChange();
  }

  private removeFile(name: string) {
    this.files = this.files.filter((f) => f.name !== name);
    this.emitChange();
  }

  private emitChange() {
    this.dispatchEvent(
      new CustomEvent("lv-files-change", {
        detail: this.files,
        bubbles: true,
        composed: true,
      })
    );
  }

  private onDragOver(e: DragEvent) {
    if (this.disabled) return;
    e.preventDefault();
    this.dragOver = true;
  }

  private onDragLeave() {
    this.dragOver = false;
  }

  private onDrop(e: DragEvent) {
    if (this.disabled) return;
    e.preventDefault();
    this.dragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) this.addFiles(files);
  }

  private onZoneKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.openPicker();
    }
  }

  render() {
    const fileCount = this.files.length;
    const liveMsg = fileCount === 0
      ? "No files selected"
      : `${fileCount} file${fileCount === 1 ? "" : "s"} selected: ${this.files.map((f) => f.name).join(", ")}`;

    return html`
      <div class="lv-file-upload">
        <input
          id=${this.inputId}
          class="lv-file-upload__input"
          type="file"
          accept=${this.accept}
          ?multiple=${this.multiple}
          ?disabled=${this.disabled}
          tabindex="-1"
          aria-hidden="true"
          @change=${this.onInputChange}
        />

        <div
          class="lv-file-upload__zone
            ${this.dragOver ? "lv-file-upload__zone--dragover" : ""}
            ${this.disabled ? "lv-file-upload__zone--disabled" : ""}"
          role="button"
          tabindex=${this.disabled ? "-1" : "0"}
          aria-label=${this.label}
          aria-describedby=${this.hint ? this.hintId : ""}
          aria-disabled=${this.disabled ? "true" : "false"}
          @click=${this.openPicker}
          @keydown=${this.onZoneKeyDown}
          @dragover=${this.onDragOver}
          @dragleave=${this.onDragLeave}
          @drop=${this.onDrop}
        >
          <span class="lv-file-upload__icon" aria-hidden="true">&#x1F4C2;</span>
          <span class="lv-file-upload__drop-label">${this.dropLabel}</span>
          ${this.hint
            ? html`<span id=${this.hintId} class="lv-file-upload__hint">${this.hint}</span>`
            : null}
        </div>

        <span id=${this.liveId} class="lv-file-upload__live" aria-live="polite" aria-atomic="true">
          ${liveMsg}
        </span>

        ${this.files.length > 0
          ? html`
            <ul class="lv-file-upload__list" aria-label="Selected files">
              ${this.files.map((f) => html`
                <li class="lv-file-upload__item">
                  <span class="lv-file-upload__item-name">${f.name}</span>
                  <span class="lv-file-upload__item-size">${this.formatSize(f.size)}</span>
                  <button
                    class="lv-file-upload__remove"
                    type="button"
                    aria-label="Remove ${f.name}"
                    @click=${() => this.removeFile(f.name)}
                  >&#x2715;</button>
                </li>
              `)}
            </ul>
          `
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-file-upload": LvFileUpload;
  }
}

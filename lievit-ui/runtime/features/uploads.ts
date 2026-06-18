/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * File uploads, client half (issue #159): an `<input type="file" l:model="photo">` (single or with
 * `multiple`) uploads the chosen bytes out-of-band, then sets the `@Wire` property to a
 * temporary-file reference (the signed temp path the server hands back). The flow (Livewire parity):
 *
 *   1. on `change`, POST the file(s) to the upload endpoint (`/lievit/upload`), emitting
 *      `lievit:upload-start` / `lievit:upload-progress` / `lievit:upload-finish` (or `-error`);
 *   2. the endpoint validates + stores to a temp disk and returns a signed relative path + metadata;
 *   3. the client sets the `l:model` field to that reference via `setModel`, so the next action /
 *      finish call carries it through the normal wire payload.
 *
 * `$cancelUpload` aborts an in-flight upload (the AbortController) and fires `lievit:upload-cancel`.
 * The bytes never ride the signed snapshot (state-never-code): the property holds a reference, not
 * the file. S3 presigned-direct upload (rejects `multiple`) is the server variant; the client posts
 * to whatever URL the endpoint returns.
 *
 * Server-side hook: an additive upload + preview controller (signed paths, sidecar meta, throttled),
 * separate from the unary wire dispatcher (ADR-0019; no dispatcher rewrite).
 */

import type { DirectiveRuntime } from "../directives.js";
import type { LievitRuntime } from "../runtime.js";

/** The signed temp-file reference the upload endpoint returns; the value an `l:model` field is set to. */
export interface TempFileRef {
  /** The HMAC-signed relative temp path (path-traversal-rejected server-side). */
  readonly path: string;
  /** The original file name. */
  readonly name: string;
  /** The byte size. */
  readonly size: number;
  /** The detected mime type. */
  readonly mime: string;
}

/** The uploader transport: POST files, return signed refs. Injectable so tests skip the network. */
export interface UploadTransport {
  readonly upload: (
    files: readonly File[],
    onProgress: (fraction: number) => void,
    signal: AbortSignal,
  ) => Promise<TempFileRef[]>;
}

/** Options for {@link installUploads}: the endpoint URL, CSRF, and an injectable transport. */
export interface UploadOptions {
  readonly endpoint?: string;
  readonly csrfToken?: string;
  readonly csrfHeader?: string;
  readonly transport?: UploadTransport;
}

/** The default fetch-based transport, posting a multipart form to the upload endpoint. */
function fetchTransport(options: UploadOptions): UploadTransport {
  const endpoint = options.endpoint ?? "/lievit/upload";
  return {
    upload: async (files, onProgress, signal) => {
      const form = new FormData();
      for (const file of files) {
        form.append("files", file, file.name);
      }
      const headers: Record<string, string> = {};
      if (options.csrfToken != null) {
        headers[options.csrfHeader ?? "X-CSRF-TOKEN"] = options.csrfToken;
      }
      onProgress(0);
      const response = await fetch(endpoint, {
        method: "POST",
        body: form,
        headers,
        credentials: "same-origin",
        signal,
      });
      if (!response.ok) {
        throw new Error(`upload failed: ${response.status}`);
      }
      onProgress(1);
      const json = (await response.json()) as { files: TempFileRef[] };
      return json.files;
    },
  };
}

/**
 * Installs file-upload handling on a runtime: a directive bound to file inputs carrying `l:model`.
 * (It registers under the `model` name but only acts on `<input type=file>`, delegating non-file
 * inputs to the built-in model directive by doing nothing — the built-in stays registered too, but
 * to avoid double-binding we guard on the file type and a marker.)
 *
 * For clarity and to avoid clobbering the built-in `l:model`, this installs as a dedicated
 * `l:upload="field"` directive instead, which the template puts on a file input alongside no
 * `l:model`. Returns the cancel handle map so a component action can `$cancelUpload`.
 *
 * @param runtime the started runtime to extend
 * @param options endpoint + CSRF + transport
 * @returns a controller exposing `cancel(input)` to abort an in-flight upload
 */
export function installUploads(
  runtime: LievitRuntime,
  options: UploadOptions = {},
): { cancel: (input: Element) => void } {
  const transport = options.transport ?? fetchTransport(options);
  const inflight = new WeakMap<Element, AbortController>();

  function emit(input: Element, name: string, detail: Record<string, unknown>): void {
    input.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  async function handle(input: HTMLInputElement, field: string, rt: DirectiveRuntime): Promise<void> {
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) {
      return;
    }
    const controller = new AbortController();
    inflight.set(input, controller);
    emit(input, "lievit:upload-start", { count: files.length });
    try {
      const refs = await transport.upload(
        files,
        (fraction) => emit(input, "lievit:upload-progress", { fraction }),
        controller.signal,
      );
      // Set the field to a single ref (single input) or an array (multiple), then defer to the
      // next action like any l:model (the reference rides the normal wire payload).
      const value = input.multiple ? refs : refs[0];
      rt.setModel(input, field, value, false);
      emit(input, "lievit:upload-finish", { files: refs });
    } catch (error) {
      if (controller.signal.aborted) {
        emit(input, "lievit:upload-cancel", {});
      } else {
        emit(input, "lievit:upload-error", { message: String(error) });
      }
    } finally {
      inflight.delete(input);
    }
  }

  runtime.directives.register({
    name: "upload",
    bind(element, _attribute, value, rt) {
      const marker = "data-lievit-upload-bound";
      if (element.hasAttribute(marker) || !(element instanceof HTMLInputElement)) {
        return;
      }
      element.setAttribute(marker, "");
      element.addEventListener("change", () => void handle(element, value, rt));
    },
  });

  return {
    cancel: (input) => {
      const controller = inflight.get(input);
      if (controller != null) {
        controller.abort();
      }
    },
  };
}

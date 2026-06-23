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

/** One presigned direct-upload descriptor, the client mirror of the server `DirectUpload` (#191). */
export interface DirectUploadDescriptor {
  /** The presigned URL to PUT the bytes to (single object). */
  readonly url: string;
  /** The HTTP method to use (typically `PUT`). */
  readonly method: string;
  /** Headers the PUT must carry (e.g. a bound `Content-Type`). */
  readonly headers?: Record<string, string>;
  /** The object key the component records once the PUT succeeds. */
  readonly key: string;
}

/** Options for {@link directUploadTransport}: the presign endpoint + CSRF (for the presign POST). */
export interface DirectUploadOptions {
  readonly presignEndpoint?: string;
  readonly csrfToken?: string;
  readonly csrfHeader?: string;
}

/**
 * A {@link UploadTransport} that uploads <strong>directly to object storage</strong> (#191): it asks
 * the server's presign endpoint for one presigned descriptor per file, PUTs each file straight to
 * its presigned URL (the bytes never proxy through the app), and returns refs whose `path` is the
 * recorded object key. The multiple+direct constraint holds per-file: one presigned PUT per file
 * (Livewire's `S3DoesntSupportMultipleFileUploads`), issued here as N sequential PUTs.
 *
 * @param options the presign endpoint + CSRF for the presign POST
 * @returns a transport that presigns then PUTs each file directly
 */
export function directUploadTransport(options: DirectUploadOptions = {}): UploadTransport {
  const presignEndpoint = options.presignEndpoint ?? "/lievit/upload/presign";
  return {
    upload: async (files, onProgress, signal) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (options.csrfToken != null) {
        headers[options.csrfHeader ?? "X-CSRF-TOKEN"] = options.csrfToken;
      }
      onProgress(0);
      const presignResponse = await fetch(presignEndpoint, {
        method: "POST",
        headers,
        credentials: "same-origin",
        signal,
        body: JSON.stringify({
          files: files.map((f) => ({ name: f.name, contentType: f.type })),
        }),
      });
      if (!presignResponse.ok) {
        throw new Error(`presign failed: ${presignResponse.status}`);
      }
      const { uploads } = (await presignResponse.json()) as { uploads: DirectUploadDescriptor[] };

      const refs: TempFileRef[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const descriptor = uploads[i];
        const putResponse = await fetch(descriptor.url, {
          method: descriptor.method,
          headers: descriptor.headers ?? {},
          body: file,
          signal,
        });
        if (!putResponse.ok) {
          throw new Error(`direct upload failed: ${putResponse.status}`);
        }
        // The component records the storage key; no temp token, the bytes are already permanent.
        refs.push({ path: descriptor.key, name: file.name, size: file.size, mime: file.type });
        onProgress((i + 1) / files.length);
      }
      return refs;
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
  // The monotonic id of the LATEST run started for an input (#9): a second file pick before the
  // first upload settles bumps this, so a slow first run that resolves late knows it was superseded
  // and skips its `setModel` (an out-of-order write would clobber `@Wire` with stale refs).
  const latestRun = new WeakMap<Element, number>();
  let runCounter = 0;

  function emit(input: Element, name: string, detail: Record<string, unknown>): void {
    input.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  async function handle(input: HTMLInputElement, field: string, rt: DirectiveRuntime): Promise<void> {
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) {
      return;
    }
    // Re-entrancy guard (#9): a second pick must not orphan the first AbortController (it would
    // become uncancellable) and must not let a slow first upload win the race. Abort the previous
    // run for this input before starting, and tag this run so a superseded late resolution is dropped.
    inflight.get(input)?.abort();
    const controller = new AbortController();
    inflight.set(input, controller);
    const runId = ++runCounter;
    latestRun.set(input, runId);
    const superseded = (): boolean => latestRun.get(input) !== runId;
    emit(input, "lievit:upload-start", { count: files.length });
    try {
      const refs = await transport.upload(
        files,
        (fraction) => emit(input, "lievit:upload-progress", { fraction }),
        controller.signal,
      );
      // A newer pick superseded this run while it was uploading: drop the result so an out-of-order
      // write never clobbers `@Wire` with stale refs (the newer run owns the field now).
      if (superseded()) {
        return;
      }
      // Set the field to a single ref (single input) or an array (multiple), then defer to the
      // next action like any l:model (the reference rides the normal wire payload).
      const value = input.multiple ? refs : refs[0];
      rt.setModel(input, field, value, false);
      emit(input, "lievit:upload-finish", { files: refs });
    } catch (error) {
      if (controller.signal.aborted) {
        emit(input, "lievit:upload-cancel", {});
      } else if (!superseded()) {
        emit(input, "lievit:upload-error", { message: String(error) });
      }
    } finally {
      // Only the latest run owns the input's in-flight slot; a superseded run settling late must not
      // delete the newer run's controller (which would leak it past a `$cancelUpload`).
      if (inflight.get(input) === controller) {
        inflight.delete(input);
      }
    }
  }

  runtime.directives.register({
    name: "upload",
    bind(element, _attribute, value, rt) {
      const marker = "data-lievit-rt-upload-bound";
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

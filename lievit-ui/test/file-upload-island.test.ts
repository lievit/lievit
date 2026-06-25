/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * file-upload is a server-first WIRE component (its server purity is pinned on the JVM in
 * lievit-kit). This file pins the NEW client island that progressively enhances the dropzone:
 * (a) the registry item now carries the .ts island file, (b) the JS-off fallback in the template
 * IS a real native multiple <input type=file name=...>, (c) the island is CSP-clean, (d) the
 * island's pure logic (image detection, size/progress formatting, reorder, preview building), and
 * (e) the drag-drop + preview wiring against a DOM shaped like the partial output.
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import type { Registry } from "../cli/registry.js";
import {
  isImage,
  formatSize,
  formatProgress,
  moveItem,
  buildPreviews,
  enhanceFileUploads,
} from "../registry/wire/file-upload/file-upload.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");

describe("file-upload registry item now carries the island", () => {
  test("the file-upload registry:wire item lists the .ts island (alias root)", () => {
    const item = registry.items.find((i) => i.name === "file-upload")!;
    const ts = item.files.find((f) => f.target.endsWith(".ts"));
    expect(ts, "file-upload now ships an island .ts").toBeDefined();
    expect(ts!.root).toBeUndefined();
    expect(ts!.target).toBe("components/ui/file-upload.ts");
  });
});

describe("file-upload server-first template fallback", () => {
  const jte = () => read("wire/file-upload/file-upload.jte");

  test("the JS-off fallback is a real native <input type=file ... multiple> the form POSTs", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\S]*?type="file"/);
    expect(markup).toContain("data-file-upload-input");
    expect(markup).toContain('multiple="${multiple}"');
    // the dropzone the island hooks drag-drop onto.
    expect(markup).toContain("data-file-upload-zone");
  });

  test("the template is server-pure: no inline <script>, no on*= handler", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});

describe("file-upload island CSP", () => {
  test("the island is CSP-clean: no eval/new Function, no Lit import", () => {
    const ts = read("wire/file-upload/file-upload.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\(|\bnew Function\b/);
    expect(code).not.toMatch(/^import .*from "lit"/m);
    expect(code).toContain("addEventListener");
  });
});

describe("file-upload island pure logic", () => {
  test("isImage matches image/* only", () => {
    expect(isImage("image/png")).toBe(true);
    expect(isImage("application/pdf")).toBe(false);
  });

  test("formatSize mirrors the server (B / KB / MB)", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(1572864)).toBe("1.5 MB");
  });

  test("formatProgress clamps [0,1] to an integer percent", () => {
    expect(formatProgress(0)).toBe("0%");
    expect(formatProgress(0.5)).toBe("50%");
    expect(formatProgress(1)).toBe("100%");
    expect(formatProgress(2)).toBe("100%");
    expect(formatProgress(-1)).toBe("0%");
  });

  test("moveItem reorders into a new array; out-of-range is a no-op copy", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  test("buildPreviews builds a thumbnail only for images (object URL injected)", () => {
    const previews = buildPreviews(
      [
        { name: "p.png", size: 10, type: "image/png" },
        { name: "d.pdf", size: 20, type: "application/pdf" },
      ],
      () => "blob:fake",
    );
    expect(previews[0].objectUrl).toBe("blob:fake");
    expect(previews[1].objectUrl).toBeNull();
    expect(previews.map((p) => p.name)).toEqual(["p.png", "d.pdf"]);
  });
});

// ---------------------------------------------------------------------------
// Drag-drop + preview wiring against a DOM shaped like file-upload.jte.
// ---------------------------------------------------------------------------

function renderRoot(): { root: HTMLElement; input: HTMLInputElement; zone: HTMLElement } {
  const root = document.createElement("div");
  root.setAttribute("data-file-upload", "");

  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.setAttribute("data-file-upload-input", "");
  root.appendChild(input);

  const zone = document.createElement("label");
  zone.setAttribute("data-file-upload-zone", "");
  root.appendChild(zone);

  document.body.appendChild(root);
  return { root, input, zone };
}

describe("file-upload island drag-drop + preview wiring", () => {
  let teardown: () => void;
  afterEach(() => {
    teardown?.();
    document.body.innerHTML = "";
  });

  test("dragover marks the zone, dragleave clears it (the highlight seam)", () => {
    const { root, zone } = renderRoot();
    teardown = enhanceFileUploads({ root, objectUrlFor: () => "blob:x" });
    zone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(zone.getAttribute("data-file-upload-dragover")).toBe("true");
    zone.dispatchEvent(new Event("dragleave", { bubbles: true }));
    expect(zone.getAttribute("data-file-upload-dragover")).toBeNull();
  });

  test("selecting files renders a client preview host with one entry per file", () => {
    const { root, input } = renderRoot();
    teardown = enhanceFileUploads({ root, objectUrlFor: () => "blob:x" });
    // happy-dom lets us assign a FileList-like via DataTransfer.
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "a.png", { type: "image/png" }));
    dt.items.add(new File(["yy"], "b.txt", { type: "text/plain" }));
    Object.defineProperty(input, "files", { value: dt.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const host = root.querySelector("[data-file-upload-previews]")!;
    const previews = host.querySelectorAll("[data-file-upload-preview]");
    expect(previews).toHaveLength(2);
    // the image gets a thumbnail, the text file does not.
    expect(host.querySelectorAll("[data-file-upload-thumb]")).toHaveLength(1);
    // every preview has a progressbar the runtime upload-progress events drive.
    expect(host.querySelectorAll('[role="progressbar"]')).toHaveLength(2);
  });

  test("a lievit:upload-progress event drives the progress bar width + aria-valuenow", () => {
    const { root, input } = renderRoot();
    teardown = enhanceFileUploads({ root, objectUrlFor: () => "blob:x" });
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "a.png", { type: "image/png" }));
    Object.defineProperty(input, "files", { value: dt.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    root.dispatchEvent(
      new CustomEvent("lievit:upload-progress", { detail: { fraction: 0.42 } }),
    );
    const bar = root.querySelector<HTMLElement>("[data-file-upload-progress]")!;
    expect(bar.style.width).toBe("42%");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });

  test("a disabled input is left as the plain native control (no enhancement)", () => {
    const { root, input } = renderRoot();
    input.disabled = true;
    teardown = enhanceFileUploads({ root, objectUrlFor: () => "blob:x" });
    expect(root.querySelector("[data-file-upload-previews]")).toBeNull();
  });

  test("enhancing twice is idempotent", () => {
    const { root, zone } = renderRoot();
    teardown = enhanceFileUploads({ root, objectUrlFor: () => "blob:x" });
    enhanceFileUploads({ root, objectUrlFor: () => "blob:x" })();
    // one dragover listener => exactly one toggled attribute, no double-wire weirdness.
    zone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(zone.getAttribute("data-file-upload-dragover")).toBe("true");
  });

  test("a root converted to the lv-file-upload controller is SKIPPED (no double-wire)", () => {
    // Coexistence during the Stimulus fan-out: the lv-file-upload controller owns a converted root's
    // lifecycle, so this legacy enhancer must leave it untouched (the convention's converted-instance
    // guard). It does not stamp data-file-upload-enhanced and binds no listeners on it.
    const { root, zone } = renderRoot();
    root.setAttribute("data-controller", "lv-file-upload");
    teardown = enhanceFileUploads({ root, objectUrlFor: () => "blob:x" });
    expect(root.getAttribute("data-file-upload-enhanced")).toBeNull();
    zone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(zone.getAttribute("data-file-upload-dragover")).toBeNull();
  });
});

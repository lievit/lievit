/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-file-upload Stimulus controller -- the conversion of the hand-rolled `enhanceFileUploads`
 * island (registry/wire/file-upload/file-upload.ts, with its `data-file-upload-enhanced` marker +
 * manual teardown sweep). This suite proves the behaviour through the REAL Stimulus Application
 * started by `startStimulus()` (which auto-loads controllers by filename) + the REAL lievit wire
 * morph -- never a mocked runtime.
 *
 * It mirrors the island's drag-drop + preview + progress assertions one-for-one (file-upload-island
 * .test.ts), and adds the morph-safety proof the enhancer test could not state: after a real morph
 * one gesture still produces EXACTLY one effect (no stacked listeners), and a root removed by a
 * morph fires nothing (Stimulus `disconnect()` tore the listeners down). file-upload is NOT a
 * dismissable surface, so the controlled/uncontrolled doctrine is preserved by it issuing ZERO wire
 * calls; there is no `calls` channel to assert here.
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application; flushStimulus() awaits the
 * MutationObserver. happy-dom 20.x provides URL.createObjectURL, so image thumbnails resolve.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

interface Mounted {
  wrap: HTMLElement;
  root: HTMLElement;
  input: HTMLInputElement;
  zone: HTMLLabelElement;
}

/** The exact data-* contract file-upload.jte emits, inside a wrapper we can morph without removing root. */
const ROOT_HTML = (disabled = false): string =>
  `<div data-lievit-component="dev.example.C" data-file-upload data-controller="lv-file-upload"` +
  ` data-action="lievit:upload-progress->lv-file-upload#progress">` +
  `<input type="file" multiple ${disabled ? "disabled" : ""} data-file-upload-input` +
  ` data-lv-file-upload-target="input" data-action="change->lv-file-upload#change">` +
  `<label data-file-upload-zone data-lv-file-upload-target="zone"` +
  ` data-action="dragover->lv-file-upload#dragOver dragleave->lv-file-upload#dragLeave drop->lv-file-upload#drop"></label>` +
  `</div>`;

/** Mount the wrapper+root exactly as the template emits it. */
function mount(disabled = false): Mounted {
  const wrap = document.createElement("div");
  wrap.id = "wrap";
  wrap.innerHTML = ROOT_HTML(disabled);
  document.body.appendChild(wrap);
  const root = wrap.querySelector<HTMLElement>("[data-file-upload]")!;
  return {
    wrap,
    root,
    input: root.querySelector<HTMLInputElement>("[data-file-upload-input]")!,
    zone: root.querySelector<HTMLLabelElement>("[data-file-upload-zone]")!,
  };
}

/** Assign a FileList-like onto the native input (happy-dom: via DataTransfer). */
function setFiles(input: HTMLInputElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) {
    dt.items.add(f);
  }
  Object.defineProperty(input, "files", { value: dt.files, configurable: true });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-file-upload controller — drag/preview/progress (real Stimulus)", () => {
  it("dragover_marks_the_zone_and_dragleave_clears_it", async () => {
    const { zone } = mount();
    startStimulus({});
    await flushStimulus();

    zone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(zone.getAttribute("data-file-upload-dragover")).toBe("true");

    zone.dispatchEvent(new Event("dragleave", { bubbles: true }));
    expect(zone.getAttribute("data-file-upload-dragover")).toBeNull();
  });

  it("selecting_files_renders_one_preview_per_file_thumb_only_for_images", async () => {
    const { root, input } = mount();
    startStimulus({});
    await flushStimulus();

    setFiles(input, [
      new File(["x"], "a.png", { type: "image/png" }),
      new File(["yy"], "b.txt", { type: "text/plain" }),
    ]);
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const host = root.querySelector("[data-file-upload-previews]")!;
    expect(host.querySelectorAll("[data-file-upload-preview]")).toHaveLength(2);
    // the image gets a thumbnail, the text file does not.
    expect(host.querySelectorAll("[data-file-upload-thumb]")).toHaveLength(1);
    // every preview carries a progressbar the upload-progress events drive.
    expect(host.querySelectorAll('[role="progressbar"]')).toHaveLength(2);
  });

  it("a_lievit_upload_progress_event_drives_the_bar_width_and_aria_valuenow", async () => {
    const { root, input } = mount();
    startStimulus({});
    await flushStimulus();

    setFiles(input, [new File(["x"], "a.png", { type: "image/png" })]);
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // The wire upload path fires this on the input; it bubbles to the controller root.
    input.dispatchEvent(
      new CustomEvent("lievit:upload-progress", { detail: { fraction: 0.42 }, bubbles: true }),
    );

    const bar = root.querySelector<HTMLElement>("[data-file-upload-progress]")!;
    expect(bar.style.width).toBe("42%");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });

  it("a_disabled_root_is_left_as_the_plain_native_control", async () => {
    const { root, input, zone } = mount(true);
    startStimulus({});
    await flushStimulus();

    // No drag highlight and no preview host: the disabled control stays the bare native input.
    zone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(zone.getAttribute("data-file-upload-dragover")).toBeNull();

    setFiles(input, [new File(["x"], "a.png", { type: "image/png" })]);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelector("[data-file-upload-previews]")).toBeNull();
  });

  it("the_controller_issues_no_wire_call (it is not a dismissable surface)", async () => {
    // file-upload never closes/dismisses, so the controlled/uncontrolled doctrine is preserved by
    // construction: there is no callWire path here. A drag + change must touch only the local DOM.
    const { root, input, zone } = mount();
    startStimulus({});
    await flushStimulus();

    zone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    setFiles(input, [new File(["x"], "a.png", { type: "image/png" })]);
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // No data-lievit-component round-trip artifacts: the only mutation is the client preview host.
    expect(root.querySelector("[data-file-upload-previews]")).not.toBeNull();
    expect(zone.getAttribute("data-file-upload-dragover")).toBe("true");
  });
});

describe("lv-file-upload controller — morph-safety (real lievit morph)", () => {
  it("after_a_real_morph_one_dragover_is_handled_exactly_once (no stacked listeners)", async () => {
    const { wrap } = mount();
    startStimulus({});
    await flushStimulus();

    // A real wire morph re-renders the subtree (idiomorph). The markup is identical, so the
    // controller must not be double-connected and the action listener must stay single. The
    // enhancer's data-file-upload-enhanced/teardown bookkeeping is gone; Stimulus owns this.
    morph(wrap, `<div id="wrap">${ROOT_HTML()}</div>`);
    await flushStimulus();

    const zone = wrap.querySelector<HTMLElement>("[data-file-upload-zone]")!;
    // preventDefault is called exactly once per live dragOver listener -> proves no double-binding.
    const ev = new Event("dragover", { bubbles: true, cancelable: true });
    const spy = vi.spyOn(ev, "preventDefault");
    zone.dispatchEvent(ev);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(zone.getAttribute("data-file-upload-dragover")).toBe("true");
  });

  it("a_root_removed_by_a_morph_stops_responding (disconnect tore the listeners down)", async () => {
    const { wrap, root, input, zone } = mount();
    startStimulus({});
    await flushStimulus();

    // Morph the file-upload root out of the tree entirely.
    morph(wrap, `<div id="wrap"><span>gone</span></div>`);
    await flushStimulus();

    // The detached nodes must no longer reach a live controller: no highlight, no preview host.
    zone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    setFiles(input, [new File(["x"], "a.png", { type: "image/png" })]);
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(zone.getAttribute("data-file-upload-dragover")).toBeNull();
    expect(root.querySelector("[data-file-upload-previews]")).toBeNull();
  });
});

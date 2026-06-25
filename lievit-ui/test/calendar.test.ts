/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * calendar (R1 RESOLVED 2026-06-19) is now a server-first WIRE component (ADR-0012): the Lit island
 * AND gest's ht-calendar (@event-calendar) escape-hatch are both retired. The grid, the events in
 * its cells, the view, the anchor and the filter live in typed Java
 * (registry/wire/calendar/CalendarComponent.java) rendered by JTE (calendar.jte), with a tiny
 * CSP-clean typed-TS enhancer (calendar.ts) for the one irreducible client bit: dragging an event
 * chip onto a day cell. This file pins (a) the registry:wire item shape + the server-purity of the
 * source, and (b) the drag enhancer's DOM behaviour against a DOM shaped exactly like the partial
 * output. The render + state transitions (grid, prev/next, view switch, event-in-cell projection,
 * debounced filter) are render-asserted on the JVM in lievit-kit (dev.lievit.kit.wire.CalendarComponentIT).
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";
import { enhanceCalendars } from "../registry/wire/calendar/calendar.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");

describe("calendar registry:wire item shape", () => {
  test("calendar is a single registry:wire item (the Lit island is gone)", () => {
    const matches = registry.items.filter((i) => i.name === "calendar");
    expect(matches, "exactly one calendar item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:wire");
  });

  test("it carries three files: a .java (java root), a .jte (jte root), a .ts (alias root)", () => {
    const item = registry.items.find((i) => i.name === "calendar")!;
    const java = item.files.find((f) => f.target.endsWith(".java"))!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!;
    const ts = item.files.find((f) => f.target.endsWith(".ts"))!;
    expect(java.root).toBe("java");
    expect(jte.root).toBe("jte");
    // the drag enhancer is an alias-root file (no java/jte root): it lands like the old island did.
    expect(ts.root).toBeUndefined();
    expect(ts.target).toBe("components/ui/calendar.ts");
  });

  test("it ships no Lit / @event-calendar dependency (server-first, R1 RESOLVED)", () => {
    const item = registry.items.find((i) => i.name === "calendar")!;
    expect(item.dependencies ?? []).not.toContain("lit");
    expect(item.dependencies ?? []).not.toContain("@event-calendar/core");
    expect(JSON.stringify(item.dependencies ?? [])).not.toMatch(/event-calendar/);
  });

  test("the wire Java holds the state in @Wire fields + the navigation/filter/move actions", () => {
    const java = read("wire/calendar/CalendarComponent.java");
    expect(java).toContain("@Wire");
    expect(java).toContain("public String view");
    expect(java).toContain("public String anchor");
    expect(java).toContain("public String filter");
    expect(java).toContain("public boolean loaded");
    expect(java).toContain("@LievitAction");
    expect(java).toContain("void prev()");
    expect(java).toContain("void next()");
    expect(java).toContain("void viewMonth()");
    expect(java).toContain("void moveEvent()");
    expect(java).toContain("void load()");
    // the events list is server-derived, kept out of the snapshot (a record list cannot round-trip).
    expect(java).toMatch(/@LievitProperty\(serialize = false\)[\s\S]*?List<Event> allEvents/);
  });

  test("the wire template is server-pure: no <slot>, no inline <script>, the optimization toolkit", () => {
    const jte = read("wire/calendar/calendar.jte");
    const markup = jte.replace(/<%--[\s\S]*?--%>/g, "");
    // the whole reason for the pivot: no native <slot>, no inline script, no @event-calendar.
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/event-calendar/);
    // it renders a real APG grid of real gridcells.
    expect(jte).toContain('role="grid"');
    expect(jte).toContain('role="gridcell"');
    // the optimization toolkit directives are present with the confirmed names.
    expect(jte).toContain('l:init="load"'); // first-paint deferral (wire:init parity)
    expect(jte).toContain("l:loading"); // in-flight feedback
    expect(jte).toContain('l:model.debounce.250ms="filter"'); // debounced filter, no per-keystroke RT
    expect(jte).toContain('l:click="prev"'); // server-side navigation
    expect(jte).toContain('l:click="next"');
    // a day cell arms the selection over the wire ($set); event chips are draggable owned markup.
    expect(jte).toContain("$set('selected'");
    expect(jte).toContain("data-calendar-event");
    expect(jte).toContain('draggable="true"');
  });

  test("the enhancer is CSP-clean: addEventListener only, no inline handler, no Lit/@event-calendar", () => {
    const ts = read("wire/calendar/calendar.ts");
    // strip comments (the doc-comment names lit/@event-calendar in prose to explain their absence).
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain('addEventListener("dragstart"');
    expect(code).toContain('addEventListener("drop"');
    expect(code).toContain("preventDefault");
    // it drives the component through the runtime $lievit object, never an eval'd string.
    expect(code).toContain('$call("moveEvent")');
    expect(code).toContain('$set("dragEventId"');
    expect(code).not.toMatch(/\bnew Function\b|\beval\(/);
    // no Lit, no @event-calendar IMPORT (the server is the single owner; the client only drops).
    expect(code).not.toMatch(/^import .*(from "lit"|@event-calendar)/m);
  });

  test("resolving the wire item pulls its tokens + icon partial dependencies", () => {
    const closure = resolve(registry, ["calendar"]).map((i) => i.name);
    expect(closure).toContain("calendar");
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
    expect(closure.indexOf("icon")).toBeLessThan(closure.indexOf("calendar"));
  });
});

// ---------------------------------------------------------------------------
// The typed-TS drag enhancer, against a DOM shaped exactly like the JTE output.
// ---------------------------------------------------------------------------

/** A minimal $lievit handle spy: records the $set / $call the enhancer fires on drop. */
interface SpyHandle {
  $set: ReturnType<typeof vi.fn>;
  $call: ReturnType<typeof vi.fn>;
}

/** Build a calendar root matching the loaded calendar.jte: a cell with a draggable event chip. */
function renderCalendar(): { root: HTMLElement; cell: HTMLElement; chip: HTMLElement } {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-component", "dev.lievit.wire.CalendarComponent");
  root.setAttribute("data-calendar", "");

  const grid = document.createElement("table");
  grid.setAttribute("role", "grid");
  grid.setAttribute("data-calendar-grid", "");
  const tbody = document.createElement("tbody");
  const tr = document.createElement("tr");

  // The source cell holding the event.
  const fromCell = document.createElement("td");
  fromCell.setAttribute("role", "gridcell");
  fromCell.setAttribute("data-calendar-cell", "2026-06-15");
  const chip = document.createElement("span");
  chip.setAttribute("data-calendar-event", "e1");
  chip.setAttribute("data-calendar-event-date", "2026-06-15");
  chip.setAttribute("draggable", "true");
  chip.textContent = "Standup";
  fromCell.appendChild(chip);

  // The target cell the chip is dropped onto.
  const toCell = document.createElement("td");
  toCell.setAttribute("role", "gridcell");
  toCell.setAttribute("data-calendar-cell", "2026-06-18");

  tr.appendChild(fromCell);
  tr.appendChild(toCell);
  tbody.appendChild(tr);
  grid.appendChild(tbody);
  root.appendChild(grid);
  document.body.appendChild(root);
  return { root, cell: toCell, chip };
}

/** A fake DataTransfer (happy-dom's DragEvent does not reliably carry one). */
function fakeDataTransfer(): DataTransfer {
  const store = new Map<string, string>();
  return {
    setData: (type: string, data: string) => store.set(type, data),
    getData: (type: string) => store.get(type) ?? "",
    effectAllowed: "uninitialized",
    dropEffect: "none",
  } as unknown as DataTransfer;
}

/** Dispatch a drag-family event with a shared dataTransfer onto a target. */
function fireDrag(
  target: EventTarget,
  type: "dragstart" | "dragover" | "drop",
  dataTransfer: DataTransfer,
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer, configurable: true });
  target.dispatchEvent(event);
  return event;
}

describe("calendar drag enhancer (the one irreducible client bit)", () => {
  let handle: SpyHandle;
  let runtime: { $lievit: (el: Element) => SpyHandle | null };
  let teardown: () => void;

  beforeEach(() => {
    handle = { $set: vi.fn(), $call: vi.fn() };
    runtime = { $lievit: () => handle };
  });

  afterEach(() => {
    teardown?.();
    document.body.innerHTML = "";
  });

  test("dropping an event chip onto a day cell arms the wire fields and fires moveEvent", () => {
    const { root, cell, chip } = renderCalendar();
    teardown = enhanceCalendars(runtime as never, root);

    const dt = fakeDataTransfer();
    fireDrag(chip, "dragstart", dt);
    expect(dt.getData("text/lievit-calendar-event")).toBe("e1");

    fireDrag(cell, "drop", dt);
    expect(handle.$set).toHaveBeenCalledWith("dragEventId", "e1");
    expect(handle.$set).toHaveBeenCalledWith("dragToDate", "2026-06-18");
    expect(handle.$call).toHaveBeenCalledWith("moveEvent");
  });

  test("dragover a day cell preventDefaults so the browser accepts the drop", () => {
    const { root, cell } = renderCalendar();
    teardown = enhanceCalendars(runtime as never, root);
    const event = fireDrag(cell, "dragover", fakeDataTransfer());
    expect(event.defaultPrevented).toBe(true);
  });

  test("a drop with no dragged id is a no-op (no wire call)", () => {
    const { root, cell } = renderCalendar();
    teardown = enhanceCalendars(runtime as never, root);
    // drop without a prior dragstart: the dataTransfer carries no event id.
    fireDrag(cell, "drop", fakeDataTransfer());
    expect(handle.$call).not.toHaveBeenCalled();
  });

  test("uses NO inline handler: behaviour rides addEventListener (CSP-clean)", () => {
    const { root, cell } = renderCalendar();
    teardown = enhanceCalendars(runtime as never, root);
    // the cell carries no on* attribute; the drop is wired purely via addEventListener.
    expect(cell.getAttribute("ondrop")).toBeNull();
  });

  test("is idempotent: enhancing an already-wired root again does not double-fire", () => {
    const { root, cell, chip } = renderCalendar();
    teardown = enhanceCalendars(runtime as never, root);
    const teardown2 = enhanceCalendars(runtime as never, root); // second pass after a morph

    const dt = fakeDataTransfer();
    fireDrag(chip, "dragstart", dt);
    fireDrag(cell, "drop", dt);
    expect(handle.$call).toHaveBeenCalledTimes(1);
    teardown2();
  });
});

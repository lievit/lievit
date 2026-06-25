/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * calendar (R1 RESOLVED 2026-06-19) is now a server-first WIRE component (ADR-0012): the Lit island
 * AND gest's ht-calendar (@event-calendar) escape-hatch are both retired. The grid, the events in
 * its cells, the view, the anchor and the filter live in typed Java
 * (registry/wire/calendar/CalendarComponent.java) rendered by JTE (calendar.jte). The one
 * irreducible client bit -- dragging an event chip onto a day cell -- is now the `lv-calendar`
 * STIMULUS CONTROLLER (runtime/stimulus/controllers/lv-calendar-controller.ts), the conversion of
 * the shipped `enhanceCalendars` enhancer. This file pins (a) the registry:wire item shape + the
 * server-purity of the source, and (b) the drag-move behaviour through the REAL Stimulus Application
 * + the REAL lievit wire morph (no mocked $lievit, no mocked runtime: a fetch stub captures the
 * actual `_calls` the runtime POSTs). The render + state transitions (grid, prev/next, view switch,
 * event-in-cell projection, debounced filter) are render-asserted on the JVM in lievit-kit
 * (dev.lievit.kit.wire.CalendarComponentIT).
 */
import { describe, test, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

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
    // the drag enhancer is an alias-root file (no java/jte root): a non-Stimulus adopter lands it
    // like the old island did. A Stimulus adopter uses the auto-loaded controller instead.
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

  test("the template drives the drag-move via the CSP-clean lv-calendar Stimulus controller", () => {
    const jte = read("wire/calendar/calendar.jte");
    const markup = jte.replace(/<%--[\s\S]*?--%>/g, "");
    // the root mounts the controller + declares the drag-family events as data-action (plain strings,
    // no eval, no inline on*=/<script> -- the strict CSP foundation).
    expect(markup).toContain('data-controller="lv-calendar"');
    expect(markup).toContain("dragstart->lv-calendar#dragStart");
    expect(markup).toContain("dragover->lv-calendar#dragOver");
    expect(markup).toContain("drop->lv-calendar#drop");
    expect(markup).not.toMatch(/\son[a-z]+=/); // no inline handlers anywhere in the rendered markup
  });

  test("the shipped enhancer is CSP-clean (non-Stimulus adopter): addEventListener only, no Lit", () => {
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
    // coexistence guard: the enhancer skips a root the lv-calendar controller already owns, so the
    // two paths cannot both fire moveEvent on one drop while the conversion fan-out coexists.
    expect(code).toContain('data-controller~="lv-calendar"');
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
// The lv-calendar Stimulus controller, against a DOM shaped exactly like the loaded calendar.jte,
// driven through the REAL Stimulus Application + the REAL lievit wire morph.
// ---------------------------------------------------------------------------

/** A runtime backed by a fetch stub that records the `_calls` the wire POSTs (no mocked $lievit). */
function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      calledActions.push(...calls);
    }
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

interface Mounted {
  componentRoot: HTMLElement;
  fromCell: HTMLElement;
  toCell: HTMLElement;
  chip: HTMLElement;
}

/**
 * Build a calendar root matching the loaded calendar.jte: the wire component markers + the
 * data-controller/data-action contract + a cell with a draggable event chip + a target cell.
 *
 * @param opts.wireComponent when false, omit data-lievit-component so the root is not a live wire
 *   component (the uncontrolled-by-construction case: callWire resolves no component -> silent drop).
 */
function mountCalendar(opts: { wireComponent?: boolean } = {}): Mounted {
  const componentRoot = document.createElement("div");
  if (opts.wireComponent !== false) {
    componentRoot.setAttribute("data-lievit-component", "dev.lievit.wire.CalendarComponent");
    componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
    componentRoot.setAttribute("data-lievit-snapshot", "s1");
  }
  componentRoot.setAttribute("data-calendar", "");
  componentRoot.setAttribute("data-controller", "lv-calendar");
  componentRoot.setAttribute(
    "data-action",
    "dragstart->lv-calendar#dragStart dragover->lv-calendar#dragOver drop->lv-calendar#drop",
  );

  const grid = document.createElement("table");
  grid.setAttribute("role", "grid");
  grid.setAttribute("data-calendar-grid", "");
  const tbody = document.createElement("tbody");
  const tr = document.createElement("tr");

  const fromCell = document.createElement("td");
  fromCell.setAttribute("role", "gridcell");
  fromCell.setAttribute("data-calendar-cell", "2026-06-15");
  const chip = document.createElement("span");
  chip.setAttribute("data-calendar-event", "e1");
  chip.setAttribute("data-calendar-event-date", "2026-06-15");
  chip.setAttribute("draggable", "true");
  chip.textContent = "Standup";
  fromCell.appendChild(chip);

  const toCell = document.createElement("td");
  toCell.setAttribute("role", "gridcell");
  toCell.setAttribute("data-calendar-cell", "2026-06-18");

  tr.appendChild(fromCell);
  tr.appendChild(toCell);
  tbody.appendChild(tr);
  grid.appendChild(tbody);
  componentRoot.appendChild(grid);
  document.body.appendChild(componentRoot);
  return { componentRoot, fromCell, toCell, chip };
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

/** Dispatch a bubbling drag-family event carrying a shared dataTransfer at a target. */
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

/** Resolve once the wire has POSTed the expected actions (the serialized $set/$set/moveEvent chain). */
async function waitForCalls(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !predicate(); i++) {
    await new Promise((r) => setTimeout(r, 2));
  }
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-calendar controller — drag-move (real Stimulus + real runtime)", () => {
  it("dropping an event chip onto a day cell arms the wire fields and fires moveEvent", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { toCell, chip } = mountCalendar();
    startStimulus({ runtime });
    await flushStimulus();

    const dt = fakeDataTransfer();
    fireDrag(chip, "dragstart", dt);
    expect(dt.getData("text/lievit-calendar-event")).toBe("e1");

    fireDrag(toCell, "drop", dt);
    await waitForCalls(() => calledActions.includes("moveEvent"));

    // The fields are armed via the framework $set magic action, then moveEvent reads them (mirrors
    // the template's own l:click="$set('selected', ...)"); all three ride the real wire.
    expect(calledActions).toContain("$set('dragEventId', 'e1')");
    expect(calledActions).toContain("$set('dragToDate', '2026-06-18')");
    expect(calledActions).toContain("moveEvent");
  });

  it("dragover a day cell preventDefaults so the browser accepts the drop", async () => {
    const { runtime } = makeRuntime();
    const { toCell } = mountCalendar();
    startStimulus({ runtime });
    await flushStimulus();

    const event = fireDrag(toCell, "dragover", fakeDataTransfer());
    expect(event.defaultPrevented).toBe(true);
  });

  it("a drop with no dragged id is a no-op (no wire call)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { toCell } = mountCalendar();
    startStimulus({ runtime });
    await flushStimulus();

    // drop without a prior dragstart: the dataTransfer carries no event id.
    fireDrag(toCell, "drop", fakeDataTransfer());
    await new Promise((r) => setTimeout(r, 20));
    expect(calledActions).toHaveLength(0);
  });

  it("uses NO inline handler: the drop rides data-action (CSP-clean)", async () => {
    const { runtime } = makeRuntime();
    const { toCell } = mountCalendar();
    startStimulus({ runtime });
    await flushStimulus();

    // the cell carries no on* attribute; the drop is wired purely via the controller's data-action.
    expect(toCell.getAttribute("ondrop")).toBeNull();
  });

  it("a calendar that is not a live wire component drops silently (uncontrolled by construction)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { toCell, chip } = mountCalendar({ wireComponent: false });
    startStimulus({ runtime });
    await flushStimulus();

    const dt = fakeDataTransfer();
    fireDrag(chip, "dragstart", dt);
    fireDrag(toCell, "drop", dt);
    await new Promise((r) => setTimeout(r, 20));
    // callWire resolves no enclosing [data-lievit-component] -> no dispatch (the old enhancer's
    // `if (!component) return`, now free): the move never reaches the wire.
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-calendar controller — morph-safety (real lievit morph)", () => {
  it("after a real morph a single drop still fires moveEvent EXACTLY once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot } = mountCalendar();
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the component subtree (idiomorph). The grid markup is
    // re-emitted identically; the controller must NOT be double-connected and the data-action must
    // stay single (the WeakSet/data-calendar-wired bookkeeping is gone; Stimulus owns this).
    morph(
      componentRoot,
      `<div data-lievit-component="dev.lievit.wire.CalendarComponent" data-lievit-snapshot="s2"
            data-calendar data-controller="lv-calendar"
            data-action="dragstart->lv-calendar#dragStart dragover->lv-calendar#dragOver drop->lv-calendar#drop">
         <table role="grid" data-calendar-grid><tbody><tr>
           <td role="gridcell" data-calendar-cell="2026-06-15">
             <span data-calendar-event="e1" data-calendar-event-date="2026-06-15" draggable="true">Standup</span>
           </td>
           <td role="gridcell" data-calendar-cell="2026-06-18"></td>
         </tr></tbody></table>
       </div>`,
    );
    await flushStimulus();

    const chip = componentRoot.querySelector<HTMLElement>("[data-calendar-event]")!;
    const toCell = componentRoot.querySelector<HTMLElement>('[data-calendar-cell="2026-06-18"]')!;
    const dt = fakeDataTransfer();
    fireDrag(chip, "dragstart", dt);
    fireDrag(toCell, "drop", dt);
    await waitForCalls(() => calledActions.includes("moveEvent"));

    expect(calledActions.filter((a) => a === "moveEvent")).toHaveLength(1);
  });

  it("a calendar removed by a morph drops nothing (disconnect tears the listeners down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, chip, toCell } = mountCalendar();
    startStimulus({ runtime });
    await flushStimulus();

    // Morph the grid (and the controller root's children) out of the tree.
    morph(
      componentRoot,
      `<div data-lievit-component="dev.lievit.wire.CalendarComponent" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached chip/cell no longer reach a live controller via the root -> no wire call.
    const dt = fakeDataTransfer();
    fireDrag(chip, "dragstart", dt);
    fireDrag(toCell, "drop", dt);
    await new Promise((r) => setTimeout(r, 20));
    expect(calledActions).toHaveLength(0);
  });
});

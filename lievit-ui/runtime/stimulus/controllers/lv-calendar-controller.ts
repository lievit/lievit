/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-calendar` -- the one irreducible client bit of the server-first calendar WIRE component
 * (ADR-0012, R1 RESOLVED), as a Stimulus controller (the conversion of the shipped
 * `registry/wire/calendar/calendar.ts` `enhanceCalendars` enhancer). Mounted on the calendar ROOT
 * via `data-controller="lv-calendar"`. The grid, the events in its cells, the view, the anchor, the
 * filter and the move are ALL server-held HTML; this controller captures the single gesture the
 * server cannot see -- native HTML drag-and-drop of an event chip onto a day cell -- arms the
 * `dragEventId` / `dragToDate` wire fields and fires the `moveEvent` action. The server owns the
 * event store: it validates the target, re-dates the event in Java, re-renders, and the client
 * morphs the chip into its new cell. There is NO Lit, NO @event-calendar, NO `<slot>`.
 *
 * Wiring (CSP-clean, NOT inline handlers -- the strict CSP refuses inline `<script>`/`on*=`):
 * - The three drag-family events all bubble to the root, so they are declared in the template as a
 *   single `data-action` on the root (`dragstart->lv-calendar#dragStart dragover->lv-calendar#dragOver
 *   drop->lv-calendar#drop`). Stimulus binds them and re-binds them automatically when a wire morph
 *   re-renders the grid -- no `connect()`-bound listener is needed (none of these is a controller-own
 *   native event nor a document-global shortcut).
 *
 * The wire seam (controlled/uncontrolled, by construction): the move rides the ONE
 * {@link callWire} seam, never `runtime.callAction` directly and never an eval'd string. `callWire`
 * is a no-op when no runtime is published OR the resolved element is not inside a live
 * `[data-lievit-component]` -- so a calendar that is not mounted as a wire component drops silently
 * (the conversion of the old enhancer's `if (!component) return`), the same safety the
 * controlled/uncontrolled doctrine gives the overlays. The two field arms use the framework
 * `$set('field', 'value')` magic action exactly as the template's own day-cell click does
 * (`l:click="$set('selected', '<date>')"`): the server parses the magic, sets the `@Wire` field,
 * then `moveEvent` reads both fields. The args are server-rendered DOM (an event id + an ISO date),
 * never user input.
 *
 * Morph-safety: Stimulus connects this controller once per root+identifier and the declared
 * `data-action`s survive the lievit wire morph + idiomorph + Turbo Drive natively (its action
 * observer re-binds re-rendered descendants). No `data-calendar-wired` marker, no `WeakSet`, no
 * teardown sweep -- the round-2 double-fire bug class is structurally impossible because Stimulus
 * owns connect/disconnect.
 */

import { Controller } from "@hotwired/stimulus";
import { callWire } from "../bridge.js";

/** The MIME-ish key the dragged event id rides under in the dataTransfer (matches the old enhancer). */
const DT_KEY = "text/lievit-calendar-event";

export default class LvCalendarController extends Controller<HTMLElement> {
  /**
   * `dragstart` on an event chip: stash the dragged event id on the dataTransfer so `drop` can read
   * it (a drag that did not start on a chip carries nothing -> a later drop is a no-op).
   */
  dragStart(event: DragEvent): void {
    const chip = (event.target as Element | null)?.closest<HTMLElement>("[data-calendar-event]");
    if (chip == null || event.dataTransfer == null) {
      return;
    }
    const id = chip.getAttribute("data-calendar-event") ?? "";
    event.dataTransfer.setData(DT_KEY, id);
    event.dataTransfer.effectAllowed = "move";
  }

  /**
   * `dragover` a day cell: `preventDefault` so the browser accepts the drop on that target (without
   * it the drop never fires); a dragover that is not over a cell is left to be rejected.
   */
  dragOver(event: DragEvent): void {
    if (cellUnder(event) == null) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer != null) {
      event.dataTransfer.dropEffect = "move";
    }
  }

  /**
   * `drop` on a day cell: read the dragged event id + the target cell's ISO date and move the event
   * server-side. A drop with no dragged id or no target date is a no-op (no wire call).
   */
  drop(event: DragEvent): void {
    const cell = cellUnder(event);
    if (cell == null || event.dataTransfer == null) {
      return;
    }
    const id = event.dataTransfer.getData(DT_KEY);
    const toDate = cell.getAttribute("data-calendar-cell") ?? "";
    if (id.length === 0 || toDate.length === 0) {
      return;
    }
    event.preventDefault();
    this.moveEvent(id, toDate);
  }

  /**
   * Arms the dragged event id + the target date into the wire, then fires the server-side move. The
   * two arms use the framework `$set` magic action (the template's established day-cell pattern); the
   * `moveEvent` action then reads both `@Wire` fields. All three ride the single {@link callWire}
   * seam, so a calendar with no live component drops silently.
   */
  private moveEvent(id: string, toDate: string): void {
    callWire(this.element, `$set('dragEventId', '${id}')`);
    callWire(this.element, `$set('dragToDate', '${toDate}')`);
    callWire(this.element, "moveEvent");
  }
}

/** The day cell under a drag event's target, or null when the pointer is not over one. */
function cellUnder(event: DragEvent): HTMLElement | null {
  return (event.target as Element | null)?.closest<HTMLElement>("[data-calendar-cell]") ?? null;
}

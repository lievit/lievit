/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import type { LievitRuntime } from "../../../runtime/index.js";

/**
 * The CSP-clean typed-TS enhancer for the server-first calendar WIRE component (ADR-0012, R1
 * RESOLVED). It is the one irreducible client bit: event drag-create / drag-resize is a client
 * gesture the server cannot see, so this module captures the native HTML drag-and-drop of an event
 * chip onto a day cell, writes the dragged event id + the target ISO date into the component's
 * `dragEventId` / `dragToDate` wire fields ($set) and fires the `moveEvent` action ($call). The
 * server owns the event store: it validates the target and re-dates the event in Java, then
 * re-renders; the client morphs the event into its new cell. There is NO Lit, NO @event-calendar,
 * NO inline `<script>` (the strict CSP refuses inline handlers, the bug the pivot exists to kill):
 * it is `addEventListener` only.
 *
 * Why a TS module and not a wire directive: native drag-and-drop (`dragstart` carrying the event id,
 * `dragover.preventDefault` to mark a valid drop target, `drop` reading the target cell's date) has
 * no server-side equivalent (the events, the layout and the move are all server-side; only the drop
 * gesture is client). This mirrors the blueprint's "escape-hatch = a typed-TS micro-enhancement, not
 * a shipped Lit island", and it is the exact seam the context-menu / input-otp enhancers use.
 *
 * Usage (the adopter calls this once from main.ts after starting the runtime):
 * ```ts
 * import { startLievit } from "lievit";
 * import { enhanceCalendars } from "./components/ui/calendar.js";
 * const runtime = startLievit();
 * enhanceCalendars(runtime);
 * ```
 */

/** The subset of the runtime the enhancer needs: resolve a component's `$lievit` object. */
type RuntimeLike = Pick<LievitRuntime, "$lievit">;

/** Marks a calendar root so the listeners are wired exactly once per element. */
const WIRED = "data-calendar-wired";

/** The MIME-ish key the dragged event id rides under in the dataTransfer. */
const DT_KEY = "text/lievit-calendar-event";

/**
 * Wires every `[data-calendar]` root on the page so dragging an event chip onto a day cell moves the
 * event server-side. Idempotent: a root already wired is skipped, so calling this after a morph that
 * re-rendered the calendar is safe.
 *
 * @param runtime the started lievit runtime (used to resolve each calendar's `$lievit` object)
 * @param root the DOM subtree to scan (defaults to `document`)
 * @returns a teardown that removes the listeners this call added
 */
export function enhanceCalendars(
  runtime: RuntimeLike,
  root: ParentNode = document,
): () => void {
  const calendars = Array.from(
    root.querySelectorAll<HTMLElement>("[data-calendar]"),
  );
  // querySelectorAll only finds descendants; include the scan root itself when it IS a calendar
  // (so passing a single calendar element as the scan root wires it, not just its children).
  if (
    root instanceof HTMLElement &&
    root.matches("[data-calendar]") &&
    !calendars.includes(root)
  ) {
    calendars.unshift(root);
  }
  const teardowns: Array<() => void> = [];

  for (const calendar of calendars) {
    if (calendar.getAttribute(WIRED) === "true") {
      continue;
    }
    calendar.setAttribute(WIRED, "true");
    teardowns.push(wireCalendar(runtime, calendar));
  }

  return () => {
    for (const teardown of teardowns) {
      teardown();
    }
  };
}

/** Wires one calendar root's drag listeners; returns a teardown removing exactly them. */
function wireCalendar(runtime: RuntimeLike, calendar: HTMLElement): () => void {
  const onDragStart = (event: DragEvent): void => {
    const chip = (event.target as Element | null)?.closest<HTMLElement>(
      "[data-calendar-event]",
    );
    if (!chip || !event.dataTransfer) {
      return;
    }
    const id = chip.getAttribute("data-calendar-event") ?? "";
    event.dataTransfer.setData(DT_KEY, id);
    event.dataTransfer.effectAllowed = "move";
  };

  // dragover must preventDefault on a valid target, else the browser rejects the drop.
  const onDragOver = (event: DragEvent): void => {
    if (cellUnder(event)) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    }
  };

  const onDrop = (event: DragEvent): void => {
    const cell = cellUnder(event);
    if (!cell || !event.dataTransfer) {
      return;
    }
    const id = event.dataTransfer.getData(DT_KEY);
    const toDate = cell.getAttribute("data-calendar-cell") ?? "";
    if (!id || !toDate) {
      return;
    }
    event.preventDefault();
    moveEvent(runtime, calendar, id, toDate);
  };

  calendar.addEventListener("dragstart", onDragStart);
  calendar.addEventListener("dragover", onDragOver);
  calendar.addEventListener("drop", onDrop);

  return () => {
    calendar.removeEventListener("dragstart", onDragStart);
    calendar.removeEventListener("dragover", onDragOver);
    calendar.removeEventListener("drop", onDrop);
  };
}

/** The day cell under a drag event's target, or null when the pointer is not over one. */
function cellUnder(event: DragEvent): HTMLElement | null {
  return (
    (event.target as Element | null)?.closest<HTMLElement>(
      "[data-calendar-cell]",
    ) ?? null
  );
}

/** Arms the dragged event id + the target date into the wire and fires the server-side move. */
function moveEvent(
  runtime: RuntimeLike,
  calendar: Element,
  id: string,
  toDate: string,
): void {
  const component = runtime.$lievit(calendar);
  if (!component) {
    return;
  }
  component.$set("dragEventId", id);
  component.$set("dragToDate", toDate);
  component.$call("moveEvent");
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lv-form Stimulus controller -- the conversion of form.jte's ONE client behaviour: move focus to
 * the validation-error summary after a failed submit (the `focusOnError` / `data-lv-autofocus`
 * contract). Proven through the REAL Stimulus Application + the REAL lievit wire morph + the REAL
 * `lievit:validation-errors` event constant (no mocked $lievit, no mocked runtime: a fetch stub
 * captures any `_calls` the runtime would POST, so the "no spurious wire round-trip" doctrine is
 * asserted, not assumed).
 *
 * Covered branches (one assertion each):
 *  - marker present on connect -> summary focused (initial render / native-POST reload / replaced form).
 *  - marker absent -> focus is NOT stolen.
 *  - the failed-submit path: a `lievit:validation-errors` window event + a real morph that adds the
 *    marker to a PRESERVED <form> (idiomorph keeps it by id, so connect() does NOT re-fire) focuses
 *    the summary, with ZERO wire calls (a form is not a dismissable overlay; it never round-trips).
 *  - morph-safety: after a real morph the event focuses EXACTLY once (no stacked listeners); a form
 *    removed by a morph fires nothing (disconnect tore the window listener down).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application started by startStimulus(), which
 * auto-loads controllers by filename. flushStimulus() awaits the MutationObserver; an extra
 * `await Promise.resolve()` drains the helper's deferred (microtask) focus.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import { VALIDATION_EFFECT_EVENT } from "../runtime/effects.js";

const COMPONENT = "com.example.Login";

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

/** The form's inner markup exactly as form.jte emits it (error summary always in DOM, gated by `hidden`). */
function formInner(opts: { withErrors?: boolean } = {}): string {
  const withErrors = opts.withErrors === true;
  const hidden = withErrors ? "" : 'hidden=""';
  const autofocus = withErrors ? 'data-lv-autofocus="true"' : "";
  const list = withErrors
    ? '<p data-slot="form-error-heading">Correggi gli errori</p><ul><li>Email obbligatoria</li></ul>'
    : "";
  return `
    <form data-slot="form" data-controller="lv-form" data-form-layout="stacked" id="login"
          method="post" novalidate="true" class="flex w-full flex-col">
      <div data-slot="form-error" id="login-errors" role="alert" aria-live="assertive"
           aria-atomic="true" tabindex="-1" ${hidden} ${autofocus}>${list}</div>
      <input name="email" id="email" />
      <button type="submit">Sign in</button>
    </form>`;
}

/** A component root (wire target) wrapping the form, so a real morph + the wire stub are realistic. */
function rootHtml(snapshot: string, opts: { withErrors?: boolean } = {}): string {
  return `<div data-lievit-component="${COMPONENT}" data-lievit-snapshot="${snapshot}">${formInner(opts)}</div>`;
}

interface Mounted {
  root: HTMLElement;
  form: HTMLFormElement;
  summary: HTMLElement;
}

function mountForm(opts: { withErrors?: boolean } = {}): Mounted {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-component", COMPONENT);
  root.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  root.setAttribute("data-lievit-snapshot", "s1");
  root.innerHTML = formInner(opts);
  document.body.appendChild(root);
  return {
    root,
    form: root.querySelector("form")!,
    summary: root.querySelector<HTMLElement>('[data-slot="form-error"]')!,
  };
}

function fireValidationErrors(): void {
  window.dispatchEvent(
    new CustomEvent(VALIDATION_EFFECT_EVENT, { detail: { email: ["Email obbligatoria"] } }),
  );
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-form controller — focus-on-error (real Stimulus + real runtime)", () => {
  it("focuses_the_error_summary_on_connect_when_the_marker_is_present", async () => {
    const { runtime } = makeRuntime();
    const { summary } = mountForm({ withErrors: true });
    startStimulus({ runtime });
    await flushStimulus();
    await Promise.resolve(); // drain the deferred focus

    expect(document.activeElement).toBe(summary);
  });

  it("does_not_steal_focus_when_no_error_marker_is_present", async () => {
    const { runtime } = makeRuntime();
    mountForm({ withErrors: false });
    const sentinel = document.createElement("button");
    document.body.appendChild(sentinel);
    sentinel.focus();

    startStimulus({ runtime });
    await flushStimulus();
    await Promise.resolve();

    expect(document.activeElement).toBe(sentinel);
  });

  it("focuses_the_summary_after_a_validation_errors_event_morphs_a_PRESERVED_form (the failed-submit path)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root, form } = mountForm({ withErrors: false });
    startStimulus({ runtime });
    await flushStimulus();

    // Production order (#93): the runtime dispatches the event, THEN morphs in the marker. The form
    // is preserved by id, so connect() does NOT re-fire -- the focus can only come from the listener.
    fireValidationErrors();
    morph(root, rootHtml("s2", { withErrors: true }));
    await Promise.resolve(); // drain the helper's deferred lookup+focus

    expect(root.querySelector("form")).toBe(form); // form element was preserved across the morph
    const summary = root.querySelector<HTMLElement>('[data-slot="form-error"]')!;
    expect(document.activeElement).toBe(summary);
    expect(calledActions).toHaveLength(0); // a form never round-trips the wire (doctrine preserved)
  });

  it("fires_focus_exactly_once_after_a_real_morph (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { root, summary } = mountForm({ withErrors: false });
    startStimulus({ runtime });
    await flushStimulus();

    // A wire morph re-renders the still-error-free, PRESERVED form. If the controller double-bound
    // its window listener, the next event would focus twice.
    morph(root, rootHtml("s2", { withErrors: false }));
    await flushStimulus();

    const focusSpy = vi.spyOn(summary, "focus"); // summary preserved by id across morphs
    fireValidationErrors();
    morph(root, rootHtml("s3", { withErrors: true }));
    await Promise.resolve();

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("a_form_removed_by_a_morph_fires_nothing (disconnect tore the window listener down)", async () => {
    const { runtime } = makeRuntime();
    const { root, summary } = mountForm({ withErrors: false });
    startStimulus({ runtime });
    await flushStimulus();

    const focusSpy = vi.spyOn(summary, "focus");
    morph(root, `<div data-lievit-component="${COMPONENT}" data-lievit-snapshot="s2"><span>gone</span></div>`);
    await flushStimulus();

    fireValidationErrors(); // controller is disconnected -> its listener is gone
    await Promise.resolve();

    expect(focusSpy).not.toHaveBeenCalled();
  });
});

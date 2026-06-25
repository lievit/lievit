<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Stimulus conversion convention (FOLLOW VERBATIM)

How to convert ONE lievit-ui client behaviour (a `*.enhancer.ts` or a hand-rolled
`data-*-enhanced`/`wireOnce` bit) into a Stimulus controller. Foundation branch:
`feat/stimulus-foundation`. Exemplars already converted (copy their shape):
`runtime/stimulus/controllers/lv-popover-controller.ts` (the overlay / controlled-uncontrolled
case) and `runtime/stimulus/controllers/lv-sidebar-controller.ts` (the shadcn-namespace case).

The point of the migration: **Stimulus owns connect/disconnect**, so the morph-safety
(reconnect after the lievit wire morph + idiomorph + Turbo Drive) and the idempotency are FREE.
Delete every `WeakSet`-of-wired-nodes, every `data-*-enhanced` marker, every `afterCall` teardown
sweep. Do NOT re-implement them.

## 0. Non-negotiable invariants (carry them through unchanged)

- **Controlled / uncontrolled doctrine** (this fixed the wire-410 "page expired" bug): an overlay
  fires a wire round-trip on close ONLY when wire-CONTROLLED (open state owned by the server). An
  uncontrolled instance closes purely client-side with **ZERO** `/lievit/<id>/call`. The doctrine
  lives ONCE in `DismissableController` (`dismissViaWire`); never re-implement it, never hardcode a
  `"close"` fallback.
- **shadcn DOM namespace** (`data-slot`, `data-sidebar`, `data-state`, ...) is canonical. Do NOT
  regress to `data-lv-*` for shadcn hooks (that drift caused the hamburger bug).
- **Strict CSP**: behaviour lives in the controller module. NEVER inline `<script>` / `on*=` in a
  `.jte`. `data-controller` / `data-action` / `data-*-target` / `data-*-value` are plain strings
  (no eval) and are allowed.
- **Turbo Drive stays**, Stimulus survives Turbo + the morph natively (both are Hotwired). Nothing
  special to do beyond binding in `connect()` and tearing down in `disconnect()`.
- **docs-first**: the bootstrap was written against the CURRENT `@hotwired/stimulus` 3.2.x docs
  (read via context7 `@hotwired/stimulus`) — do not invent API from memory.

## 1. File layout (ONE self-contained file per component — no central registry edit)

```
runtime/stimulus/
  application.ts          bootstrap + autoload (DO NOT EDIT when adding a controller)
  bridge.ts               the Stimulus -> lievit-wire seam (callWire); DO NOT duplicate
  base/
    dismissable-controller.ts   shared base: controlled/uncontrolled doctrine + return-focus
    focus-trap.ts               shared FocusTrap util (trap + return-focus)
  controllers/
    lv-<name>-controller.ts     <-- YOU ADD EXACTLY ONE FILE HERE per conversion
```

The controller is **auto-loaded by filename** via Vite's `import.meta.glob` in `application.ts`.
Adding `controllers/lv-foo-controller.ts` registers identifier `lv-foo` automatically — you NEVER
edit a central registry/index, so parallel conversions never collide. Filename -> identifier:
`lv-popover-controller.ts` -> `lv-popover`; `overlay/menu-controller.ts` -> `overlay--menu`.

**Naming**: prefix every lievit controller identifier with `lv-` (avoids clobbering an adopter's
own controllers). File `lv-<name>-controller.ts`, class `export default class Lv<Name>Controller`.

Base classes live OUTSIDE `controllers/` (in `base/`) so the autoloader never registers them.

## 2. The controller (shape to copy)

```ts
import { DismissableController } from "../base/dismissable-controller.js"; // if it dismisses
// or: import { Controller } from "@hotwired/stimulus";                    // if it does not

export default class LvFooController extends DismissableController<HTMLElement> {
  static targets = ["panel", "trigger"];      // Stimulus targets (typed below)
  static values = { open: Boolean };          // typed state read from data-lv-foo-open-value

  declare readonly hasPanelTarget: boolean;
  declare readonly panelTarget: HTMLElement;

  private readonly onKey = (e: KeyboardEvent): void => this.handleKey(e);

  connect(): void {
    // bind ONLY listeners that data-action cannot express (document/window globals, the element's
    // own native events like `toggle`). Element-event wiring belongs in the template as data-action.
    this.element.addEventListener("toggle", this.onToggle);   // example: native popover toggle
    document.addEventListener("keydown", this.onKey);          // example: a global shortcut
  }

  disconnect(): void {
    this.element.removeEventListener("toggle", this.onToggle); // ALWAYS mirror connect()
    document.removeEventListener("keydown", this.onKey);       // Stimulus calls this on morph-out
  }
}
```

Rules:
- **No idempotency bookkeeping.** Stimulus connects each element+identifier once and disconnects on
  removal. If you write a `WeakSet` / `data-*-enhanced` guard you did it wrong.
- **Every listener bound in `connect()` is removed in `disconnect()`** (object-identity handler,
  stored once as a class field — see `onKey` above). This is what stops leaked listeners across
  morphs.
- **Prefer `data-action` for element events** (click, input, submit, native `toggle` on a child):
  it is declared in the template and Stimulus re-binds it automatically when the morph re-renders
  the element. Use `connect()`-bound listeners ONLY for: (a) the controller element's OWN native
  event, (b) document/window-global shortcuts (a `keydown@document` action descriptor does NOT fire
  reliably in the happy-dom test substrate, so bind those in `connect()` and remove in `disconnect()`).

## 3. Targets / actions / values (template side, CSP-clean)

In the `.jte`, on the controller's root element:
```html
<div data-controller="lv-foo" data-lv-foo-open-value="${open}"> ... </div>
```
On actionable descendants (clicks, inputs):
```html
<button data-action="click->lv-foo#toggle" data-lv-foo-target="trigger">...</button>
```
- **Targets**: `data-<identifier>-target="name"`, read as `this.nameTarget` / `this.nameTargets`
  / `this.hasNameTarget`. Use targets to reach descendants instead of `querySelector`.
- **Values**: `data-<identifier>-<value>-value="..."`, typed via `static values`. Use for NEW
  state. For the **overlay family keep the established `data-lv-wire-close` / `data-lv-opener`
  attributes** (the base + golden tests already speak them) rather than renaming to Stimulus values.
- **No data hardcoded in a partial** (option lists, enums-as-strings): it arrives via `@param`,
  per the React-first frontend rule. The controller reads DOM the server rendered, never invents it.

## 4. Talking to the wire (controlled instances only)

A controller NEVER imports the runtime. It reaches the wire through ONE seam:
- Extend `DismissableController` and call `this.dismissViaWire(from?, meta?)` on close. The base
  reads `data-lv-wire-close` from its element: present+non-empty => CONTROLLED => the named action
  rides the wire on the enclosing `[data-lievit-component]`; absent => UNCONTROLLED => **no call**.
- Need a non-close wire action? Import `callWire(el, action, meta?)` from `../bridge.js`. It is a
  no-op when `action` is blank or no runtime is published — so an uncontrolled path is safe by
  construction. NEVER call `runtime.callAction` directly from a controller.

The template stamps `data-lv-wire-close="${escapeAction}"` ONLY when the open state is server-owned
(see `popover.jte`: `data-lv-wire-close="${controlled ? escapeAction : null}"`). Do not add a
default; an uncontrolled overlay whose host has no matching `@LievitAction` -> 410 page-expired.

## 5. Focus management

Reuse `FocusTrap` from `base/focus-trap.ts`; do NOT re-roll a trap (it was reimplemented 4+ times):
```ts
import { FocusTrap } from "../base/focus-trap.js";
connect()    { this.trap = new FocusTrap(this.element, { onEscape: () => this.dismissViaWire() }); this.trap.activate(); }
disconnect() { this.trap.deactivate(); }
```
- Modal surface (dialog/drawer/sheet/alert-dialog): `new FocusTrap(el, { onEscape })` (traps Tab +
  scroll-locks + returns focus).
- Light surface that only wants focus restored on close (sidebar off-canvas): use the base's
  `captureReturnFocus()` / `restoreReturnFocus(unless?)` (no Tab trap).
- Initial-focus priority is handled for you: `[data-initial-focus]` > `[autofocus]` > first
  focusable > the container.

## 6. The test (REAL controller + REAL morph — never a mock)

Mirror `test/lv-popover-controller.test.ts` (the canonical template). A test that mocks `$lievit`
or a `LievitRuntime` certifies nothing — use the real runtime with a fetch stub.

```ts
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";

afterEach(() => { stopStimulus(); document.body.innerHTML = ""; });

it("...", async () => {
  const calls: string[] = [];
  const runtime = new LievitRuntime({ fetchImpl: async (_u, init) => {
    const c = JSON.parse((init?.body as string) ?? "{}")._calls as string[] | undefined;
    if (c) calls.push(...c);
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  } as unknown as typeof fetch });

  // 1) build the DOM exactly as the .jte emits it (data-controller + the data-* contract).
  // 2) start Stimulus with the real runtime, then AWAIT the MutationObserver:
  startStimulus({ runtime });
  await flushStimulus();
  // 3) drive a REAL gesture/event and assert the observable DOM (+ `calls` for wire behaviour).
});
```

Mandatory cases for any converted component:
- **Behaviour parity**: one assertion per real branch the old enhancer test had (do not drop any).
- **Controlled fires / uncontrolled silent** (if it dismisses): controlled DOM (`data-lv-wire-close`
  present) fires the action exactly once; uncontrolled DOM (absent) yields `calls.length === 0`.
  This is the whole-contract rule — assert BOTH branches, never just the happy one.
- **Morph-safety**: after `morph(root, root.outerHTML)` + `await flushStimulus()`, one gesture =>
  one effect (no stacked listeners). And a `morph` that REMOVES the element => the detached node
  fires nothing (disconnect tore the listener down). See the two morph-safety tests in the popover
  exemplar.

Gates (run until green, both): `npx vitest run` and `bash test/jte-compile/run.sh`. After a
template change also run `npm run build:registry` (regenerates `registry.json`, which embeds the
`.jte` source — the drift gate fails otherwise) and `npm run typecheck`.

## 7. Coexistence during the fan-out (don't break unconverted components)

The old enhancers stay installed (`installAllFeatures`) for components not yet converted. When you
convert a component that an old SHARED enhancer also scans (e.g. `popover-anchor.enhancer.ts` scans
every `[popover][data-lv-opener]`), add a guard so the enhancer SKIPS the converted instance — see
the `data-controller~="lv-popover"` guard added in `popover-anchor.enhancer.ts`. This prevents
double-handling (a controlled overlay firing its close twice) while both paths coexist. When the
LAST consumer of a shared enhancer is converted, delete the enhancer + its install line in a
dedicated cleanup PR (regenerate `registry.json` if it was a `registry/` file).

## 8. Bootstrap (already done — adopter `main.ts`, for reference)

```ts
import { startLievit, installAllFeatures } from "lievit-ui/runtime";
import { startStimulus } from "lievit-ui/runtime/stimulus";
const runtime = startLievit({}, (rt) => installAllFeatures(rt));
startStimulus({ runtime });   // AFTER startLievit; publishes the runtime to the wire bridge
```
Vite (gest = Vite 8, vitest) transforms the autoload glob. A non-Vite adopter registers controllers
manually on the returned `Application` (the glob no-ops there).

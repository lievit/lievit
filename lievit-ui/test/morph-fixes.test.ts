/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { morph } from "../runtime/morph.js";

/**
 * Morph regression tests for three fixes (the morph algorithm is Idiomorph since ADR-0084; these
 * pin the lievit wiring around it):
 *  - #13: a native text input the user typed into can be SERVER-CLEARED / changed (the dirty `.value`
 *    property follows a server-asserted value, not just the attribute).
 *  - render-rec: client-runtime morph markers live under ONE reserved prefix (`data-lievit-rt-*`),
 *    preserved across a morph; a non-namespaced stale attribute is still reconciled away.
 *  - #12: a leading sibling insertion. Idiomorph matches siblings by ID-SET first, soft-match (tag +
 *    position) second; it has no LCS pass. So an ID-keyed sibling keeps its identity (and in-progress
 *    typing) across the shift — the bug the bespoke morph hit is GONE for keyed nodes; a genuinely
 *    UNKEYED sibling (no id) still pairs by position and mis-pairs, which is fundamental to any greedy
 *    morph, so the user-side mitigation remains: give siblings a stable `id`.
 */

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.firstElementChild as HTMLElement;
}

describe("morph: a server-asserted value clears/updates a dirty native input (#13)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("CLEARS a native text input the user typed into when the server asserts value=''", () => {
    document.body.innerHTML = '<div data-lievit-component="X"><input name="q" value=""></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const input = el.querySelector("input")!;
    input.value = "stale typing"; // the dirty .value detaches from the value="" attribute

    // The server re-asserts an empty value (a successful submit that cleared the field).
    morph(el, '<div data-lievit-component="X"><input name="q" value=""></div>');

    expect(el.querySelector("input")).toBe(input); // same node, morphed in place
    expect(input.value, "the server-asserted empty value cleared the dirty property").toBe("");
  });

  it("UPDATES a native text input to a server-asserted non-empty value", () => {
    document.body.innerHTML = '<div data-lievit-component="X"><input name="q" value="initial"></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const input = el.querySelector("input")!;
    input.value = "user typed over it";

    morph(el, '<div data-lievit-component="X"><input name="q" value="server-set"></div>');

    expect(input.value, "the server-asserted value won over the dirty local edit").toBe("server-set");
  });

  it("still PRESERVES the user's typing when the server does NOT assert a value", () => {
    // The complement of #13: an un-asserted re-render must keep in-progress typing (the existing
    // contract). This guards the fix from going too far (clearing on every morph).
    document.body.innerHTML = '<div data-lievit-component="X"><input name="q"><span>0</span></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const input = el.querySelector("input")!;
    input.value = "keep me";

    morph(el, '<div data-lievit-component="X"><input name="q"><span>1</span></div>');

    expect(input.value).toBe("keep me");
    expect(el.querySelector("span")!.textContent).toBe("1");
  });

  it("CLEARS a dirty textarea the user typed into when the server asserts value=''", () => {
    document.body.innerHTML = '<div data-lievit-component="X"><textarea name="b" value=""></textarea></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const area = el.querySelector("textarea")!;
    area.value = "draft text";

    morph(el, '<div data-lievit-component="X"><textarea name="b" value=""></textarea></div>');

    expect(area.value).toBe("");
  });
});

describe("morph: client markers are preserved under one reserved prefix (render-rec)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("preserves a data-lievit-rt-* client marker the server never authors", () => {
    const el = root('<div data-lievit-component="X" data-lievit-rt-bound-l-click=""></div>');

    // The server's new markup never carries the runtime bind marker; the morph must NOT strip it
    // (stripping would let the re-scan re-bind the directive and stack a duplicate listener).
    morph(el, '<div data-lievit-component="X"></div>');

    expect(el.hasAttribute("data-lievit-rt-bound-l-click")).toBe(true);
  });

  it("still reconciles away a NON-reserved stale attribute the server dropped", () => {
    const el = root('<div data-lievit-component="X" data-lievit-rt-init-fired="" data-stale="y"></div>');

    morph(el, '<div data-lievit-component="X"></div>');

    expect(el.hasAttribute("data-lievit-rt-init-fired"), "reserved marker kept").toBe(true);
    expect(el.hasAttribute("data-stale"), "non-reserved stale attribute removed").toBe(false);
  });
});

describe("morph: leading sibling insertion (#12, Idiomorph id-set matching)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("GOLDEN: a leading insertion among genuinely UNKEYED inputs still mis-pairs (no LCS, fundamental)", () => {
    // Inputs distinguished only by class (NO id) are genuinely unkeyed: Idiomorph matches siblings by
    // id-set first, then soft-match (tag + position). With no id there is nothing to key on, so a
    // prepended same-tag input shifts positions by one and the live FIRST node is reused for the new
    // FIRST slot — its identity (and the in-progress typing the morph then overwrites) drifts to the
    // wrong logical field. This is fundamental to any greedy, no-LCS morph (bespoke OR Idiomorph); the
    // mitigation is keying (next test). The point of this golden is to PIN that lievit does not claim
    // to solve anonymous-sibling identity, so adopters know to key.
    document.body.innerHTML =
      '<div data-lievit-component="X"><input class="a" value="A"><input class="b" value="B"></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const liveFirst = el.querySelectorAll("input")[0]! as HTMLInputElement;
    liveFirst.value = "user typing in A"; // dirty, un-asserted while the server re-renders

    // The server prepends a NEW input; the existing two shift right.
    morph(
      el,
      '<div data-lievit-component="X"><input class="new" value="N"><input class="a" value="A"><input class="b" value="B"></div>',
    );

    const inputs = Array.from(el.querySelectorAll("input")) as HTMLInputElement[];
    expect(inputs.map((i) => i.getAttribute("class"))).toEqual(["new", "a", "b"]);
    // The #12 mis-pair persists for anonymous siblings: positional matching reused the live FIRST node
    // for the new FIRST slot (class="new"), so its node identity drifted to the wrong logical field.
    expect(inputs[0], "the live first node drifted into the wrong slot").toBe(liveFirst);
    expect(inputs[0].getAttribute("class")).toBe("new");
  });

  it("GOLDEN: ID-KEYING the inputs preserves identity (and typing) across the same leading insertion (#12 FIXED for keyed nodes)", () => {
    // The win Idiomorph brings over the bespoke morph: id-set matching MOVES a keyed node wherever it
    // sits (it does NOT destroy+recreate it), so the dirty value in "a" survives the leading insertion.
    // This is the case the bespoke morph's #12 limitation targeted; with Idiomorph it is correct.
    document.body.innerHTML =
      '<div data-lievit-component="X"><input id="a" name="a"><input id="b" name="b"></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const liveA = el.querySelector("#a")! as HTMLInputElement;
    liveA.value = "user typing in A";

    morph(
      el,
      '<div data-lievit-component="X"><input id="new" name="new"><input id="a" name="a"><input id="b" name="b"></div>',
    );

    const after = el.querySelector("#a")! as HTMLInputElement;
    expect(Array.from(el.querySelectorAll("input")).map((i) => i.id)).toEqual(["new", "a", "b"]);
    expect(after, "the keyed input kept its node identity (moved, not recreated)").toBe(liveA);
    expect(after.value, "keyed -> the in-progress typing survived").toBe("user typing in A");
  });
});

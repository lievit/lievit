/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Render-asserting checks for the server-first notification-bell partial family: the topbar bell
 * (the Filament Livewire/DatabaseNotifications component, the io.lievit.kit.NotificationBell
 * view-model). notification-bell.jte (badge-count trigger + native-popover panel) +
 * notification-bell/header.jte (mark-all-read / clear-all) + notification-bell/item.jte (one
 * read/unread row). It composes the existing badge + icon + separator partials and rides the same
 * native-popover overlay seam the dropdown-menu uses, so the panel reveals with ZERO shipped JS.
 *
 * Like the other static-partial suites, this Node harness has no JTE compiler, so the load-bearing
 * contract is pinned on the partial SOURCE as text: the data-slot taxonomy, the count badge (only
 * when unread, decorative), the popover trigger + role=menu panel, the read/unread row state +
 * unread dot, the mark-all-read / clear-all / mark-read wire-action affordances, the aria contract,
 * token-only styling, the Apache header + JTE comment syntax, and NO inline <script> / on* handler /
 * Lit island. The real-compiler golden runs out of band via `npm run test:jte-compile`.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

const FAMILY = [
  "notification-bell.jte",
  "notification-bell/header.jte",
  "notification-bell/item.jte",
] as const;

describe("notification-bell family -- shared hygiene", () => {
  test.each(FAMILY)("%s carries the Apache header + a usage-doc comment (<%-- --%>), no @* *@", (f) => {
    const src = read(f);
    expect(src, "missing Apache copyright header").toContain("Copyright 2026 Francesco Bilotta");
    expect(src, "missing Apache license line").toContain("Apache License, Version 2.0");
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test.each(FAMILY)("%s has no inline <script> and ZERO inline on* handlers (strict CSP)", (f) => {
    const src = read(f);
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test.each(FAMILY)("%s is server-first: no Lit island residue", (f) => {
    const src = read(f);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
  });

  test.each(FAMILY)("%s never reaches for Font Awesome / wa-icon", (f) => {
    const src = read(f);
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test.each(FAMILY)("%s is token-driven: no bare hex colours", (f) => {
    const src = read(f);
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src, "must read --lv-* tokens").toMatch(/var\(--lv-/);
  });
});

describe("notification-bell.jte -- the badge-count trigger + popover panel", () => {
  const src = read("notification-bell.jte");

  test("declares its public API: id, unreadCount, header, notifications, empty, placement, disabled", () => {
    for (const p of ["id", "unreadCount", "label", "header", "notifications", "empty", "placement", "disabled"]) {
      expect(src, `missing @param ${p}`).toMatch(new RegExp(`@param[^\\n]*\\b${p}\\b`));
    }
  });

  test("carries the slot taxonomy: bell / trigger / count / panel / list / empty", () => {
    for (const slot of [
      "notification-bell",
      "notification-bell-trigger",
      "notification-bell-count",
      "notification-bell-panel",
      "notification-bell-list",
      "notification-bell-empty",
    ]) {
      expect(src, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("the trigger opens the panel via the native popover seam (no JS, no z-index war)", () => {
    expect(src, "trigger must be a popovertarget button").toMatch(/popovertarget="\$\{id\}"/);
    expect(src, "trigger must be a menu button").toContain('aria-haspopup="menu"');
    expect(src, "panel must be a native auto popover").toContain('popover="auto"');
    expect(src, "panel must use CSS anchor positioning").toMatch(/position-anchor/);
    expect(src, "panel must light-dismiss + flip").toMatch(/position-try-fallbacks:flip-block/);
  });

  test("shows the bell icon and the count badge ONLY when there are unread (decorative count)", () => {
    expect(src, "must render the bell icon").toMatch(/icon\(name = "bell"/);
    expect(src, "count must be gated on hasUnread").toMatch(/@if\(hasUnread\)/);
    expect(src, "count must reuse the badge partial").toMatch(/@template\.lievit\.badge\(/);
    expect(src, "count badge must be destructive variant").toMatch(/variant = "destructive"/);
    expect(src, "count pill is decorative (count is in the aria-label)").toMatch(/notification-bell-count[\s\S]*?aria-hidden="true"/);
    expect(src, "must clamp the count to 99+").toContain("99+");
  });

  test("the trigger's accessible name states the unread count", () => {
    expect(src, "must build an aria-label with the count").toMatch(/ariaLabel[\s\S]*?unreadCount[\s\S]*?unread/);
    expect(src, "trigger must carry the aria-label").toMatch(/aria-label="\$\{ariaLabel\}"/);
  });

  test("the panel is a labelled role=menu with the header, a separator, then the rows", () => {
    expect(src, "panel must be role=menu").toMatch(/notification-bell-panel"[\s\S]*?role="menu"/);
    expect(src, "panel must be labelled").toMatch(/notification-bell-panel"[\s\S]*?aria-label/);
    expect(src, "must render the header slot").toMatch(/\$\{header\}/);
    expect(src, "must separate header from list").toMatch(/@template\.lievit\.separator\(\)/);
    expect(src, "must render the notifications slot").toMatch(/\$\{notifications\}/);
  });

  test("falls back to the empty slot when there are no notifications", () => {
    expect(src, "must branch on a null notifications slot").toMatch(/@if\(notifications != null\)/);
    expect(src, "must render the empty slot in the else").toMatch(/\$\{empty\}/);
  });
});

describe("notification-bell/header.jte -- mark-all-read + clear-all actions", () => {
  const src = read("notification-bell/header.jte");

  test("declares the action API: markAllReadAction + clearAllAction + a title", () => {
    for (const p of ["title", "markAllReadAction", "clearAllAction", "formId", "disabled"]) {
      expect(src, `missing @param ${p}`).toMatch(new RegExp(`@param[^\\n]*\\b${p}\\b`));
    }
  });

  test("renders a header strip with a title and the two action buttons (slots)", () => {
    for (const slot of [
      "notification-bell-header",
      "notification-bell-title",
      "notification-bell-mark-all-read",
      "notification-bell-clear-all",
    ]) {
      expect(src, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("mark-all-read / clear-all are real server-first form actions (formaction), never inline JS", () => {
    expect(src, "mark-all-read must post via formaction when an action is set").toMatch(/formaction="\$\{markAllReadAction.isEmpty\(\)/);
    expect(src, "clear-all must post via formaction when an action is set").toMatch(/formaction="\$\{clearAllAction.isEmpty\(\)/);
    expect(src, "buttons submit when an action is present").toMatch(/markAllReadAction.isEmpty\(\) \? "button" : "submit"/);
  });

  test("actions are labelled (icon + text), never icon-only", () => {
    expect(src, "mark-all-read carries a text label").toMatch(/\$\{markAllReadLabel\}/);
    expect(src, "clear-all carries a text label").toMatch(/\$\{clearAllLabel\}/);
    expect(src, "the mark-all-read icon is decoration").toMatch(/icon\(name = "check"/);
    expect(src, "clear uses the trash icon").toMatch(/icon\(name = "trash-2"/);
  });
});

describe("notification-bell/item.jte -- one read/unread notification row", () => {
  const src = read("notification-bell/item.jte");

  test("declares the row API: title, body, time, unread, href, markReadAction", () => {
    for (const p of ["title", "body", "time", "icon", "unread", "href", "markReadAction"]) {
      expect(src, `missing @param ${p}`).toMatch(new RegExp(`@param[^\\n]*\\b${p}\\b`));
    }
  });

  test("the row state is data-state=unread|read keyed on the server unread flag", () => {
    expect(src, "must compute the state word from unread").toMatch(/var state = unread \? "unread" : "read"/);
    expect(src, "row must carry data-state").toMatch(/data-state="\$\{state\}"/);
    expect(src, "row must be a role=menuitem").toMatch(/role="menuitem"/);
  });

  test("an unread row shows a colour-independent dot announced to assistive tech", () => {
    expect(src, "unread branch must render the dot").toMatch(/@if\(unread\)[\s\S]*?notification-bell-item-dot/);
    expect(src, "the dot states 'unread' for screen readers").toMatch(/notification-bell-item-dot"[\s\S]*?aria-label="unread"/);
  });

  test("carries the content slots: title / body / time", () => {
    for (const slot of [
      "notification-bell-item",
      "notification-bell-item-content",
      "notification-bell-item-title",
      "notification-bell-item-body",
      "notification-bell-item-time",
    ]) {
      expect(src, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("the mark-read action shows only on unread rows and posts a wire action (formaction)", () => {
    expect(src, "mark-read gated on unread + an action url").toMatch(/@if\(unread && !markReadAction.isEmpty\(\)\)/);
    expect(src, "mark-read posts via formaction").toMatch(/formaction="\$\{markReadAction\}"/);
    expect(src, "mark-read is a real labelled button").toMatch(/notification-bell-item-mark-read"[\s\S]*?aria-label="\$\{markReadLabel\}"/);
  });

  test("the row is a real <a> when href is set, an inert div otherwise", () => {
    expect(src, "must branch on a link row").toMatch(/var isLink = !href.isEmpty\(\)/);
    expect(src, "link row is a real anchor").toMatch(/<a href="\$\{href\}"/);
  });
});

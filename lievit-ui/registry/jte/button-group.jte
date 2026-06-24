@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui button-group partial -- a layout wrapper that collapses inner border-radius and
  merges adjacent borders on any children (buttons, inputs, selects, icon buttons).

  TIER: PARTIAL presentational -- pure layout/styling, zero client state, zero JS.
  Server-first is trivial: a layout container has nothing interactive of its own.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Toolbar structural pattern
  (https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) -- button-group maps to the STRUCTURAL
  half: role="group" with an optional aria-label so AT announces the set as one labelled unit.
  No roving tabindex (the toolbar keyboard model) because this wraps HETEROGENEOUS controls;
  each child is an independent tab stop. Ant Design Button Group (border-collapse, shared
  radius reset) as inventory reference for the visual join trick. Tailwind UI inspired styling.

  A11y (WAI-ARIA role=group):
    Roles: <div role="group" aria-label?> -- unlabelled group is valid (role=region requires
    a label; role=group does not). Children carry their own roles (native button/input/a).
    Keyboard: platform. Each child is an independent tab stop (Tab/Shift+Tab). No roving tabindex.
    Focus ring: [&>*:focus-visible]:relative [&>*:focus-visible]:z-10 raises focused children
    above their neighbours so the ring is never clipped by a collapsed border.
    No live region. No shared enhancer (layout wrapper; simplest tier).

  Params:
    gg.jte.Content content              REQUIRED. Children to join.
    String orientation = "horizontal"   "horizontal" | "vertical" -- flex axis + join axis.
    String label       = null           aria-label on the root div. null = unlabelled (valid).
    String cssClass    = ""             Extra utility classes on the root element.
    String attrs       = ""             TRUSTED raw ($unsafe). STATIC author-typed strings only
                                        (e.g. data-testid="toolbar"). Never user/DB data.

  Usage:
    @@template.lievit.button-group(label = "Text alignment", content = @@`
      @@template.lievit.button(content = @@`Left`)
      @@template.lievit.button(content = @@`Center`)
      @@template.lievit.button(content = @@`Right`)
    `)
    @@template.lievit.button-group(orientation = "vertical", attrs = "data-testid=\"actions\"", content = @@`
      <button type="button">Up</button>
      <button type="button">Down</button>
    `)
--%>
@param gg.jte.Content content
@param String orientation = "horizontal"
@param String label = null
@param String cssClass = ""
@param String attrs = ""

!{var horizontal = !"vertical".equals(orientation);}
!{var axis = horizontal ? "flex-row" : "flex-col";}
!{var joinReset = horizontal
    ? "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none"
    : "[&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none";}

<div
  role="group"
  aria-label="${label}"
  data-slot="button-group"
  data-orientation="${orientation}"
  class="inline-flex w-fit items-stretch ${axis} [&>*:focus-visible]:relative [&>*:focus-visible]:z-10 ${joinReset} ${cssClass}"
  $unsafe{attrs}
>${content}</div>

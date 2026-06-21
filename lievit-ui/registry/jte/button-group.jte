@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui button-group partial -- groups buttons into a segmented control with shared
  borders + collapsed inner rounding (the "joined buttons" look).

  TIER: STATIC presentational -> JTE partial. The group is pure layout/styling over the
  buttons the adopter passes in; no client state. (A toggle-group, which DOES carry
  pressed-state, is the interactive Lit island -- a separate component.)

  STRUCTURE (scientific decision rule): shadcn's ButtonGroup is a `role="group"` div whose
  CSS collapses the rounding + shared border between adjacent children
  ([&>*:not(:first-child)]:rounded-l-none + border-l-0, vertical flips axis). We map that
  structure verbatim to Tailwind utilities so ANY child (button, our input-group, a select)
  joins seamlessly -- shadcn wins on styling/markup ergonomics here and there is no a11y
  behaviour to defer to Radix beyond the group role.

  A11y (Radix/shadcn model): role="group" + an optional aria-label so AT announces the set as
  one labelled group. Keyboard behaviour stays each button's own (Tab moves between them); a
  button-group is not a radio/toolbar, so no roving tabindex is imposed. focus-visible buttons
  raise their z-index so the focus ring is never clipped by a neighbour's border.

  Params:
    gg.jte.Content content        the buttons (and/or nested groups/inputs) to join.
    String orientation = "horizontal"   horizontal | vertical.
    String label       = null     aria-label for the group; null => unlabelled group.
    String cssClass    = ""       extra utility classes on the root.

  Usage:
    @template.lievit.button-group(label = "Text alignment", content = @`
      @template.lievit.button(content = @`Left`)
      @template.lievit.button(content = @`Center`)
      @template.lievit.button(content = @`Right`)
    `)

    @template.lievit.button-group(orientation = "vertical", content = @`
      <button type="button" class="...">Up</button>
      <button type="button" class="...">Down</button>
    `)
--%>
@param gg.jte.Content content
@param String orientation = "horizontal"
@param String label = null
@param String cssClass = ""

!{var horizontal = !orientation.equals("vertical");}
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
>
  ${content}
</div>

@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui accordion-item partial -- one disclosure item of the accordion (shadcn AccordionItem +
  AccordionTrigger + AccordionContent), a native <details>/<summary> with ZERO JS, CSP-clean.

  STRUCTURE (shadcn): <details data-slot="accordion-item"> > <summary data-slot="accordion-trigger">
  (the label + a trailing chevron-down, shadcn's `border-b`-separated header) + <div
  data-slot="accordion-content"> filled from the caller's Content slot. The trigger links the
  content for assistive tech via a deterministic id pair (aria-controls / aria-labelledby), and the
  native <summary> already exposes aria-expanded.

  Single-mode (only one item open at a time) is opted into by giving sibling items the SAME `name`
  (the platform <details name=...> grouping, no JS); omit `name` for independent items.

  Chevron rotate-on-open is opt-in via the adopter stylesheet (see accordion.jte): the strict CSP
  forbids the <style> block here. The .lv-accordion-chevron class is the hook.

  Params:
    String label                  the trigger label (the header text).
    gg.jte.Content content        the panel body.
    String id        = "lv-acc"   id stem; the trigger gets "<id>-trigger", the panel "<id>-panel".
    String name      = null       a <details> group name => single-open mode across same-named items.
    boolean open     = false      render this item initially expanded (<details open>).
    String cssClass  = ""         extra utility classes on the <details>.

  Usage:
    @@template.lievit.accordion-item(label = "Anagrafica", id = "anag", open = true,
      content = @@`<p>...</p>`)
--%>
@param String label
@param gg.jte.Content content
@param String id = "lv-acc"
@param String name = null
@param boolean open = false
@param String cssClass = ""

!{var triggerId = id + "-trigger";}
!{var panelId = id + "-panel";}

<details
  data-slot="accordion-item"
  name="${name}"
  open="${open}"
  class="${cssClass}"
  style="border-bottom: 1px solid var(--lv-color-border);"
>
  <summary
    data-slot="accordion-trigger"
    id="${triggerId}"
    class="lv-accordion-trigger"
    aria-controls="${panelId}"
    style="display: flex; align-items: center; justify-content: space-between; gap: var(--lv-space-4); width: 100%; list-style: none; cursor: pointer; padding: var(--lv-space-4); font-size: var(--lv-text-base); font-weight: var(--lv-font-medium); color: var(--lv-color-fg);"
  >
    <span>${label}</span>
    <span aria-hidden="true" class="lv-accordion-chevron" style="flex-shrink: 0; display: inline-flex; color: var(--lv-color-muted-fg); transition: transform 0.2s ease;">
      @template.lievit.icon(name = "chevron-down", size = "1rem")
    </span>
  </summary>
  <div
    data-slot="accordion-content"
    id="${panelId}"
    role="region"
    aria-labelledby="${triggerId}"
    style="padding: 0 var(--lv-space-4) var(--lv-space-4); font-size: var(--lv-text-base); color: var(--lv-color-fg); line-height: var(--lv-leading);"
  >
    ${content}
  </div>
</details>

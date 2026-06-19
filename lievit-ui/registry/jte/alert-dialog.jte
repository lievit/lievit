@import gg.jte.Content
<%--
  lievit-ui :: alert-dialog (static JTE partial)

  The STATIC confirmation-panel markup for a destructive-or-important confirm: a title, a
  description, and a cancel + action button pair. Mirrors shadcn's AlertDialog content set
  (AlertDialogHeader / Title / Description / Footer / Cancel / Action).

  Tier rationale: this partial is PURELY the panel content + token styling, with no client
  behaviour of its own. The modal behaviour (open/close, focus trap, Escape, return-focus,
  backdrop) is the EXISTING interactive `dialog` island (`<lv-dialog>`, registry/components/
  dialog/). Composition: render this partial inside `<lv-dialog>`'s default slot and drive
  `<lv-dialog open>` from the trigger. So the static look lives here (copy-in, owned), the
  behaviour upgrades via the dialog dependency (the planning upgrade-split).

  WHY a SEPARATE alertdialog and not the plain dialog: WAI-ARIA distinguishes role="dialog"
  (general) from role="alertdialog" (an interruptive prompt requiring a response). A confirm
  is the alertdialog case, so this panel sets role="alertdialog" + aria-labelledby (title) +
  aria-describedby (description) ON ITS OWN ROOT, making it correct whether wrapped by the
  island or rendered as a static panel. (When inside <lv-dialog>, the island's own
  role="dialog" wrapper is the backdrop/trap; this inner alertdialog is the labelled content.)

  VARIANT DECISION (scientific rule). shadcn styles the action button with the default button
  variant and asks the caller to opt into `buttonVariants({variant:"destructive"})`; Radix is
  behaviour-only. We fold that into one `destructive` boolean: false -> primary action button
  (--lv-color-primary), true -> destructive action button (--lv-color-destructive). The cancel
  button is always the neutral/outline style (shadcn's "outline" cancel). The destructive path
  also adds a triangle-alert icon next to the title (shadcn-grade affordance for a dangerous op).

  Accessibility (APG alertdialog): role="alertdialog"; the title is referenced by
  aria-labelledby and the description by aria-describedby (both via generated ids derived from
  `name`); cancel is listed first in the DOM but the action is the visually primary affordance.
  Both are real <button>s with a token focus ring. The icons are decorative (Lucide partial).

  ACTION WIRING: the action/cancel buttons carry no behaviour here. Pass `actionAttrs` /
  `cancelAttrs` (raw attribute strings, e.g. a form's `formaction`, an `hx-*`, or a
  `data-lv-close`) so the caller wires submit/close to its own flow. Cancel defaults to a
  `data-lv-dialog-close` hook the caller can bind to dismiss the island.

  Params:
    String name                  base id seed for the labelledby/describedby wiring (unique per dialog).
    String title                 the prompt headline (e.g. "Eliminare il contatto?").
    String description = null    supporting explanation; null => omitted (and no aria-describedby).
    String cancelLabel = "Annulla"  the dismiss button text.
    String actionLabel = "Conferma" the confirm button text.
    boolean destructive = false  destructive styling (red action button + alert icon).
    String actionAttrs = ""      raw extra attributes injected on the action <button>.
    String cancelAttrs = ""      raw extra attributes injected on the cancel <button>.
    String klass        = ""     extra classes on the alertdialog root.

  Usage:
    @@template.alert-dialog(
      name = "delete-contact", title = "Eliminare il contatto?",
      description = "L'operazione non e' reversibile.",
      actionLabel = "Elimina", destructive = true,
      actionAttrs = "formaction=\"/contatti/42/delete\""
    )

    Wrapped in the interactive dialog island:
    <lv-dialog open="${open}">
      @@template.alert-dialog(name = "confirm", title = "Confermi?", actionLabel = "Si")
    </lv-dialog>
--%>
@param String name
@param String title
@param String description = null
@param String cancelLabel = "Annulla"
@param String actionLabel = "Conferma"
@param boolean destructive = false
@param String actionAttrs = ""
@param String cancelAttrs = ""
@param String klass = ""

!{var titleId = name + "-title";}
!{var descId = name + "-desc";}
!{var hasDescription = description != null && !description.isBlank();}

<div
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="${titleId}"
  aria-describedby="${hasDescription ? descId : null}"
  data-slot="alert-dialog"
  class="flex w-full max-w-lg flex-col gap-[var(--lv-space-4)] rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] p-[var(--lv-space-6)] shadow-[var(--lv-shadow-lg)]"
  style="font-family:var(--lv-font-sans);"
>
  <div data-slot="alert-dialog-header" class="flex flex-col gap-[var(--lv-space-2)]">
    <h2 id="${titleId}" data-slot="alert-dialog-title" class="flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] tracking-tight text-[var(--lv-color-fg)]">
      @if(destructive)
        <span class="flex items-center text-[var(--lv-color-destructive)]">@template.icon(name = "triangle-alert", size = "1.25rem")</span>
      @endif
      ${title}
    </h2>
    @if(hasDescription)
      <p id="${descId}" data-slot="alert-dialog-description" class="text-[length:var(--lv-text-sm)] leading-[var(--lv-leading-relaxed)] text-[var(--lv-color-muted-fg)]">${description}</p>
    @endif
  </div>

  <div data-slot="alert-dialog-footer" class="flex flex-col-reverse gap-[var(--lv-space-2)] sm:flex-row sm:justify-end">
    <button
      type="button"
      data-slot="alert-dialog-cancel"
      data-lv-dialog-close
      $unsafe{cancelAttrs}
      class="inline-flex h-[var(--lv-space-10)] items-center justify-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] transition-colors hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
    >${cancelLabel}</button>
    <button
      type="button"
      data-slot="alert-dialog-action"
      data-destructive="${destructive}"
      $unsafe{actionAttrs}
      class="inline-flex h-[var(--lv-space-10)] items-center justify-center rounded-[var(--lv-radius-md)] px-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] shadow-[var(--lv-shadow-xs)] transition-colors focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] ${destructive ? "bg-[var(--lv-color-destructive)] text-[var(--lv-color-destructive-fg)] hover:opacity-90" : "bg-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)] hover:opacity-90"}"
    >${actionLabel}</button>
  </div>
</div>

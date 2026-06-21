@import gg.jte.Content
<%--
  lievit-ui :: skeleton (static JTE partial)

  A loading placeholder that pulses while real content is fetched. Mirrors shadcn's
  Skeleton (animate-pulse + rounded fill) but draws its colour from the --lv-* tokens
  so a retheme is a token override, not a markup edit.

  Tier rationale: a skeleton is pure presentation with no client state/lifecycle, so it
  is a JTE partial, not a Lit island (DONE criterion 1).

  Decision (scientific rule): shadcn fills with `bg-accent`; lievit-tokens has no accent
  token, so the fill is a soft mix of --lv-color-muted over the page background. This
  reads as a placeholder while deriving from the muted token the contract calls for, and
  rethemes with the tokens. Radius reuses --lv-radius-md (shadcn `rounded-md`).

  Params:
    shape  - "block" (default, a rectangle sized by width/height), "text" (a short line,
             height fixed to one text row), or "circle" (avatar placeholder).
    width  - CSS width  (e.g. "100%", "12rem"). Default "100%".
    height - CSS height (e.g. "1rem", "8rem").  Default "1rem".
    klass  - extra classes appended to the element (utilities the caller owns).
    label  - accessible label announced to screen readers. Default "Loading".

  Usage:
    @@template.lievit.skeleton(height = "8rem")
    @@template.lievit.skeleton(shape = "text", width = "60%")
    @@template.lievit.skeleton(shape = "circle", width = "2.5rem", height = "2.5rem")
--%>
@param String shape = "block"
@param String width = "100%"
@param String height = "1rem"
@param String klass = ""
@param String label = "Loading"
<div
  data-slot="skeleton"
  role="status"
  aria-busy="true"
  aria-live="polite"
  aria-label="${label}"
  class="lv-skeleton animate-pulse ${shape.equals("circle") ? "rounded-full" : "rounded-[var(--lv-radius-md)]"} ${klass}"
  style="width:${width};height:${shape.equals("text") ? "var(--lv-text-base)" : height};background-color:color-mix(in srgb, var(--lv-color-muted) 22%, var(--lv-color-bg));"
>
  <span class="sr-only">${label}</span>
</div>

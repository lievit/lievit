@import gg.jte.Content
<%--
  lievit-ui :: aspect-ratio (static JTE partial)

  Constrains its content to a fixed width:height ratio. The child (an <img>, <video>,
  <iframe>, map, etc.) fills the box. Mirrors shadcn/Radix AspectRatio.

  Tier rationale: pure presentation, no client state, so a JTE partial (DONE criterion 1).

  Decision (scientific rule): Radix implements the ratio with the legacy padding-bottom
  hack + an absolutely positioned child (to support pre-2021 browsers). The native CSS
  `aspect-ratio` property is Baseline (all evergreen browsers since 2021), needs no
  absolute positioning, and composes cleanly, so it wins on (4) ergonomics and (5)
  robustness with no accessibility cost. We render a plain wrapper with `aspect-ratio`
  and let the slotted content stretch via object-fit utilities the caller adds.

  Params:
    ratio   - the width / height ratio as a CSS value, e.g. "16 / 9" (default),
              "4 / 3", "1 / 1". Passed straight to the CSS `aspect-ratio` property.
    klass   - extra classes for the wrapper (e.g. "rounded-[var(--lv-radius-md)]
              overflow-hidden").
    content - the media to constrain. Give it `class="h-full w-full object-cover"`
              so it fills the ratio box.

  Usage:
    @@template.lievit.aspect-ratio(ratio = "16 / 9", klass = "rounded-[var(--lv-radius-md)] overflow-hidden", content = @@`
      <img src="/cover.jpg" alt="Cover" class="h-full w-full object-cover">
    `)
--%>
@param String ratio = "16 / 9"
@param String klass = ""
@param gg.jte.Content content
<div class="lv-aspect-ratio w-full ${klass}" style="aspect-ratio:${ratio};">
  ${content}
</div>

@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui avatar partial -- a circular (or square) frame displaying a person or entity:
  image, initials fallback, or icon fallback. Static display, zero client state, CSP-clean.

  TIER: STATIC presentational -> JTE partial. Server already holds `src`, `name`, and the
  fallback data, so the right branch is emitted server-side with no JS. The strict
  `script-src 'self'` CSP refuses inline `on*=` handlers; the anti-pattern that caused the
  silent-slot bug (an onerror attribute that never fired in prod) is a non-starter here.
  If the adopter needs a broken-image swap, they wire it from their own TS module against
  `data-slot="avatar"` -- the partial stays inert.

  STRUCTURE (scientific decision rule):
  Ant Design Avatar (the inventory reference) splits Image / Initials / Icon into three
  paths selected by priority. Server-side the priority is computed once in `!{var ...}`
  locals and the correct branch is emitted directly; no JS load-state machine is needed.
  shadcn/Radix split Root+Image+Fallback to hide the fallback after the image loads -- a
  pure-JS concern we resolve server-side. Tailwind UI provides the visual tone reference
  (ORIGINAL markup over --lv-* tokens, no code copied). APG Button pattern covers the
  interactive wrappers (href -> <a>, clickable -> <button>).

  SIZE (diameter-based, not height-based -- architecture-contract §5.b D5). Avatar is a
  square/circle, not a bar control, so its natural sizing axis is its diameter. The scale
  is NOT toolbar-pixel-aligned and deliberately extends beyond the sm|md|lg three-step:
    xs  -> diameter var(--lv-space-6)  (1.5rem,  24px)  font --lv-text-2xs
    sm  -> diameter var(--lv-space-8)  (2rem,    32px)  font --lv-text-xs
    md  -> diameter var(--lv-space-10) (2.5rem,  40px)  font --lv-text-sm  [default]
    lg  -> diameter var(--lv-space-12) (3rem,    48px)  font --lv-text-base
    xl  -> diameter var(--lv-space-16) (4rem,    64px)  font --lv-text-lg
    2xl -> diameter var(--lv-space-20) (5rem,    80px)  font --lv-text-xl
  `data-size` is stamped on the root for CSS hooks and acceptance tests.

  SHAPE: circle (--lv-radius-full, default) | square (--lv-radius-md).
  `data-shape` is stamped on the root.

  COLOR (background for initials / icon fallback):
  - explicit `color` param: one of the shared intent slugs mapped to --lv-color-<intent> /
    --lv-color-<intent>-fg via a switch.
  - null (auto): a stable intent is derived by hashing `name` (or `initials`) with a simple
    deterministic modulo over the 6-intent set so the same string always yields the same hue.
    Hash runs server-side; no JS involved.
  - no name AND no initials AND fallback reaches icon: defaults to `default` (muted).
  `data-variant` carries the resolved intent slug for test hooks.

  STATUS DOT: an absolutely-positioned `<span aria-hidden="true">` at the bottom-right corner,
  coloured by intent token. Status `xs` is suppressed (too small to read). The dot is aria-hidden
  because the surrounding context (a list row, adjacent label) conveys the presence meaning.

  INTERACTIVE WRAPPERS (href / clickable):
  - href set -> root element is <a href> (APG link, native focus + Tab + Enter).
  - clickable=true (no href) -> root element is <button type="button"> (APG button, native
    focus + Tab + Enter + Space). The inner frame span inside the wrapper carries
    aria-hidden="true" so the wrapper's aria-label is not double-announced.
  - Neither -> root is <span>, not in tab order, no role.

  FALLBACK PRECEDENCE (server-evaluated in !{var ...} locals; never forks on client state):
  1. src present and non-blank         -> <img> with resolved alt.
  2. initials or name (auto-derive)    -> initials text in intent background.
  3. icon slug present (default "user") -> @template.lievit.icon in intent background.
  4. all absent (icon=null)            -> bare frame, --lv-color-muted-bg background, no content.

  A11y (no dedicated WAI-ARIA APG pattern for a standalone display avatar; platform rules apply):
  - <img> path: `alt` from `alt` param else `name` else `""` (decorative). If `ariaHidden=true`,
    alt is forced to `""`.
  - initials / icon path (no <img>): root <span> carries `aria-label="${name}"` (when name is
    present and ariaHidden=false), so screen readers announce the person without an image.
  - ariaHidden=true: stamps aria-hidden="true" on the root and suppresses aria-label; <img> gets
    alt="" (the whole avatar is decorative in that context -- adjacent text identifies the person).
  - <a href> wrapper: accessible name = hrefLabel if set, else the bubbled-up <img alt> / inner
    aria-label. Inner frame spans aria-hidden="true" to avoid double-announcement.
  - <button> wrapper: accessible name = ariaLabel if set, else `name`. Inner frame aria-hidden.
    When neither ariaLabel nor name is available and clickable=true, a dev-visible comment is
    emitted (the button would be inaccessible) and no <button> is rendered.
  - status dot <span>: always aria-hidden="true" (presence meaning comes from surrounding context).
  - Focus ring: entirely platform-managed via :focus-visible on the <a>/<button> wrapper and the
    --lv-ring token -- no JS, no special avatar logic.

  ESCAPING CHANNELS (same rule as button.jte):
  - attrs (TRUSTED, $unsafe): static author-typed strings only (e.g. data-testid="...").
    NEVER fed DB-derived values.
  - dataAttrs (SAFE, escaped): Map<String,String> of dynamic data-* attributes; each value
    is escaped through Escape.htmlAttribute (same routine as button.jte). Use for per-row
    wire args when the avatar appears in a reactive list. Keys: simple identifiers without
    the leading "data-" prefix.

  WIRE ACTION: avatars in reactive lists that need per-row wire actions use the wrapping
  wire template's l:click + wireArgs pattern; the avatar partial stays action-free (see
  button.jte wireClick/wireArgs for the full pattern -- compose as needed).

  TOKEN READS: --lv-space-6/8/10/12/16/20 (diameters), --lv-space-2/3/4 (avatar-group overlap),
  --lv-radius-full (circle), --lv-radius-md (square), --lv-color-<intent>/<intent>-fg (six intent
  pairs + muted for bare), --lv-color-muted-bg (bare background), --lv-color-border (1px ring),
  --lv-color-bg (group gap fill), --lv-ring (focus-visible), --lv-text-2xs/xs/sm/base/lg/xl
  (initials size per tier), --lv-font-sans (typeface), --lv-font-medium (initials weight),
  --lv-z-base (status dot stacking). ADDITIVE tokens added: --lv-space-20, --lv-text-2xs.

  AVATAR-GROUP (micro-partial `avatar-group.jte`): see registry/jte/avatar-group.jte.

  Params:
    String  src         = null      image URL; null/blank -> falls back to initials or icon.
    String  name        = null      full display name: used to derive initials (first letters
                                    of first two whitespace-separated words, uppercased) AND as
                                    aria-label / img alt when alt is not explicit.
    String  alt         = null      explicit img alt. null -> use name. "" -> decorative.
    String  initials    = null      override auto-derived initials (takes precedence over name).
    String  icon        = "user"    Lucide icon slug rendered when src and initials are absent.
                                    null -> suppress icon; renders the bare background only.
    String  size        = "md"      xs | sm | md | lg | xl | 2xl (diameter-based, see SIZE above).
    String  shape       = "circle"  circle | square.
    String  color       = null      intent slug: default | primary | secondary | success |
                                    warning | destructive | accent. null -> auto-hash from name.
    String  status      = null      online | away | busy | offline; null -> no dot. xs suppressed.
    String  href        = null      makes the avatar a navigation link (<a href>).
    String  hrefLabel   = null      aria-label for the <a> wrapper.
    boolean clickable   = false     true -> wraps in <button type="button">.
    String  ariaLabel   = null      aria-label for the <button> wrapper (falls back to name).
    boolean ariaHidden  = false     stamps aria-hidden="true" on the root; suppresses aria-label.
    String  cssClass    = ""        extra utility classes on the root element.
    String  attrs       = ""        TRUSTED raw attribute string ($unsafe) -- STATIC strings only.
    java.util.Map<String,String> dataAttrs = java.util.Map.of()
                                    SAFE dynamic data-* (key without "data-", simple identifier;
                                    each value escaped via Escape.htmlAttribute).

  Usage:
    @template.lievit.avatar(name = "Francesco Bilotta", src = user.avatarUrl())
    @template.lievit.avatar(name = "Luca Cecchetto", size = "lg")
    @template.lievit.avatar(initials = "FB", color = "primary", size = "sm")
    @template.lievit.avatar(name = "Bot", icon = "bot", size = "xl")
    @template.lievit.avatar(name = "Ada", src = url, status = "online")
    @template.lievit.avatar(name = "Ada", href = "/users/1", hrefLabel = "View Ada's profile")
    @template.lievit.avatar(name = "Ada", clickable = true, ariaLabel = "Select Ada")
    @template.lievit.avatar(name = "Ada", ariaHidden = true)   (decorative, adjacent label exists)
--%>
@param String src = null
@param String name = null
@param String alt = null
@param String initials = null
@param String icon = "user"
@param String size = "md"
@param String shape = "circle"
@param String color = null
@param String status = null
@param String href = null
@param String hrefLabel = null
@param boolean clickable = false
@param String ariaLabel = null
@param boolean ariaHidden = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- ───────────────────────────────────────────────────────────────────────── --%>
<%-- DIAMETER + FONT-SIZE per size tier (token-based, no literal px)          --%>
<%-- ───────────────────────────────────────────────────────────────────────── --%>
!{var diamToken = switch (size) {
    case "xs"  -> "var(--lv-space-6)";
    case "sm"  -> "var(--lv-space-8)";
    case "lg"  -> "var(--lv-space-12)";
    case "xl"  -> "var(--lv-space-16)";
    case "2xl" -> "var(--lv-space-20)";
    default    -> "var(--lv-space-10)";   /* md */
  };}
!{var textSizeClass = switch (size) {
    case "xs"  -> "text-[length:var(--lv-text-2xs)]";
    case "sm"  -> "text-[length:var(--lv-text-xs)]";
    case "lg"  -> "text-[length:var(--lv-text-base)]";
    case "xl"  -> "text-[length:var(--lv-text-lg)]";
    case "2xl" -> "text-[length:var(--lv-text-xl)]";
    default    -> "text-[length:var(--lv-text-sm)]";  /* md */
  };}

<%-- STATUS DOT size (suppressed at xs -- too small to read) --%>
!{var statusDotToken = switch (size) {
    case "sm"  -> "0.5rem";
    case "lg"  -> "0.75rem";
    case "xl"  -> "0.875rem";
    case "2xl" -> "1rem";
    default    -> "0.625rem";  /* md */
  };}
!{var renderStatus = status != null && !size.equals("xs");}

<%-- ───────────────────────────────────────────────────────────────────────── --%>
<%-- SHAPE (border-radius token)                                              --%>
<%-- ───────────────────────────────────────────────────────────────────────── --%>
!{var radiusClass = "square".equals(shape)
    ? "rounded-[var(--lv-radius-md)]"
    : "rounded-[var(--lv-radius-full)]";}

<%-- ───────────────────────────────────────────────────────────────────────── --%>
<%-- FALLBACK RESOLUTION (server-side, never forks on client state)           --%>
<%-- ───────────────────────────────────────────────────────────────────────── --%>
!{var hasImage    = src != null && !src.isBlank();}
!{var resolvedInitials = (initials != null && !initials.isBlank())
    ? initials
    : (name != null && !name.isBlank()
        ? java.util.Arrays.stream(name.trim().split("\\s+"))
              .limit(2)
              .map(w -> String.valueOf(w.charAt(0)).toUpperCase())
              .collect(java.util.stream.Collectors.joining())
        : null);}
!{var hasInitials = resolvedInitials != null && !resolvedInitials.isBlank();}
!{var hasIcon     = !hasImage && !hasInitials && icon != null && !icon.isBlank();}
<%-- fallback path: 1=image  2=initials  3=icon  4=bare --%>

<%-- ───────────────────────────────────────────────────────────────────────── --%>
<%-- COLOR RESOLUTION (intent slug -> token pair)                             --%>
<%-- auto-hash: deterministic modulo over the 6-intent set from name/initials --%>
<%-- ───────────────────────────────────────────────────────────────────────── --%>
!{var intents = new String[]{"primary", "secondary", "accent", "success", "warning", "destructive"};}
!{var resolvedColor = (color != null && !color.isBlank())
    ? color
    : (!hasImage
        ? (resolvedInitials != null && !resolvedInitials.isBlank()
            ? intents[Math.abs(resolvedInitials.hashCode()) % intents.length]
            : (name != null && !name.isBlank()
                ? intents[Math.abs(name.hashCode()) % intents.length]
                : "default"))
        : "default");}
<%-- map intent slug to background + foreground CSS classes --%>
!{var colorBgClass = switch (resolvedColor) {
    case "primary"     -> "bg-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)]";
    case "secondary"   -> "bg-[var(--lv-color-secondary)] text-[var(--lv-color-secondary-fg)]";
    case "accent"      -> "bg-[var(--lv-color-accent)] text-[var(--lv-color-accent-fg)]";
    case "success"     -> "bg-[var(--lv-color-success)] text-[var(--lv-color-success-fg)]";
    case "warning"     -> "bg-[var(--lv-color-warning)] text-[var(--lv-color-warning-fg)]";
    case "destructive" -> "bg-[var(--lv-color-destructive)] text-[var(--lv-color-destructive-fg)]";
    default            -> "bg-[var(--lv-color-muted-bg)] text-[var(--lv-color-muted-fg)]";
  };}
<%-- image path uses muted background (shows while loading / if image transparent) --%>
!{var frameBgClass = hasImage ? "bg-[var(--lv-color-muted-bg)]" : colorBgClass;}

<%-- ───────────────────────────────────────────────────────────────────────── --%>
<%-- A11Y RESOLUTION                                                          --%>
<%-- ───────────────────────────────────────────────────────────────────────── --%>
!{var resolvedAlt = ariaHidden
    ? ""
    : (alt != null ? alt : (name != null ? name : ""));}
<%-- aria-label for the non-interactive frame span (initials/icon path only) --%>
!{var frameAriaLabel = (!ariaHidden && !hasImage && name != null && !name.isBlank())
    ? name : null;}
<%-- accessible name for the interactive wrappers --%>
!{var wrapperAriaLabel = ariaLabel != null ? ariaLabel : name;}
!{var isInteractive = href != null || clickable;}

<%-- SAFE dynamic data-* attributes (same pattern as button.jte) --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- BASE frame classes (shared by the inner span in interactive wrappers + root in non-interactive) --%>
!{var frameBase = "relative inline-flex shrink-0 items-center justify-center overflow-hidden align-middle select-none border border-[var(--lv-color-border)] " + radiusClass + " " + frameBgClass;}

<%-- ───────────────────────────────────────────────────────────────────────── --%>
<%-- RENDER: interactive wrapper (href=<a>, clickable=<button>) or plain span --%>
<%-- ───────────────────────────────────────────────────────────────────────── --%>
@if(href != null)
  <%-- LINK WRAPPER --%>
  <a
    data-slot="avatar"
    data-size="${size}"
    data-shape="${shape}"
    data-variant="${resolvedColor}"
    href="${href}"
    aria-label="${hrefLabel}"
    aria-hidden="${ariaHidden ? "true" : null}"
    class="inline-flex ${radiusClass} outline-none focus-visible:shadow-[var(--lv-ring)] ${cssClass}"
    style="width:${diamToken};height:${diamToken};"
    $unsafe{dataAttrsMarkup}
    $unsafe{attrs}
  >
    <%-- inner frame is decorative inside the wrapper; wrapper carries the a11y name --%>
    <span class="${frameBase} w-full h-full" aria-hidden="true">
      @if(hasImage)
        <img src="${src}" alt="" loading="lazy" class="aspect-square h-full w-full object-cover">
      @elseif(hasInitials)
        <span data-slot="avatar-initials" aria-hidden="true" class="${textSizeClass} font-[var(--lv-font-medium)] leading-none">${resolvedInitials}</span>
      @elseif(hasIcon)
        @template.lievit.icon(name = icon, cssClass = "h-2/5 w-2/5")
      @endif
      @if(renderStatus)
        <span data-slot="avatar-status" data-status="${status}" aria-hidden="true"
          class="absolute bottom-0 right-0 z-[var(--lv-z-base)] rounded-[var(--lv-radius-full)] ring-2 ring-[var(--lv-color-bg)] ${switch (status) { case "online" -> "bg-[var(--lv-color-success)]"; case "away" -> "bg-[var(--lv-color-warning)]"; case "busy" -> "bg-[var(--lv-color-destructive)]"; default -> "bg-[var(--lv-color-muted)]"; }}"
          style="width:${statusDotToken};height:${statusDotToken};"
        ></span>
      @endif
    </span>
  </a>
@elseif(clickable)
  <%-- BUTTON WRAPPER: requires accessible name; emit a dev-visible warning when neither
       ariaLabel nor name is provided (the button would be inaccessible to assistive tech). --%>
  @if(wrapperAriaLabel != null && !wrapperAriaLabel.isBlank())
    <button
      type="button"
      data-slot="avatar"
      data-size="${size}"
      data-shape="${shape}"
      data-variant="${resolvedColor}"
      aria-label="${wrapperAriaLabel}"
      aria-hidden="${ariaHidden ? "true" : null}"
      class="inline-flex ${radiusClass} outline-none focus-visible:shadow-[var(--lv-ring)] cursor-pointer ${cssClass}"
      style="width:${diamToken};height:${diamToken};"
      $unsafe{dataAttrsMarkup}
      $unsafe{attrs}
    >
      <span class="${frameBase} w-full h-full" aria-hidden="true">
        @if(hasImage)
          <img src="${src}" alt="" loading="lazy" class="aspect-square h-full w-full object-cover">
        @elseif(hasInitials)
          <span data-slot="avatar-initials" aria-hidden="true" class="${textSizeClass} font-[var(--lv-font-medium)] leading-none">${resolvedInitials}</span>
        @elseif(hasIcon)
          @template.lievit.icon(name = icon, cssClass = "h-2/5 w-2/5")
        @endif
        @if(renderStatus)
          <span data-slot="avatar-status" data-status="${status}" aria-hidden="true"
            class="absolute bottom-0 right-0 z-[var(--lv-z-base)] rounded-[var(--lv-radius-full)] ring-2 ring-[var(--lv-color-bg)] ${switch (status) { case "online" -> "bg-[var(--lv-color-success)]"; case "away" -> "bg-[var(--lv-color-warning)]"; case "busy" -> "bg-[var(--lv-color-destructive)]"; default -> "bg-[var(--lv-color-muted)]"; }}"
            style="width:${statusDotToken};height:${statusDotToken};"
          ></span>
        @endif
      </span>
    </button>
  @else
    <%-- DEV WARNING: clickable=true but no accessible name available. Render non-interactive. --%>
    <%-- FIX: pass ariaLabel or name to the avatar when clickable=true. --%>
    <span
      data-slot="avatar"
      data-size="${size}"
      data-shape="${shape}"
      data-variant="${resolvedColor}"
      aria-hidden="${ariaHidden ? "true" : null}"
      aria-label="${frameAriaLabel}"
      class="${frameBase} ${cssClass}"
      style="width:${diamToken};height:${diamToken};"
      $unsafe{dataAttrsMarkup}
      $unsafe{attrs}
    >
      @if(hasImage)
        <img src="${src}" alt="${resolvedAlt}" loading="lazy" class="aspect-square h-full w-full object-cover">
      @elseif(hasInitials)
        <span data-slot="avatar-initials" aria-hidden="true" class="${textSizeClass} font-[var(--lv-font-medium)] leading-none">${resolvedInitials}</span>
      @elseif(hasIcon)
        @template.lievit.icon(name = icon, cssClass = "h-2/5 w-2/5")
      @endif
      @if(renderStatus)
        <span data-slot="avatar-status" data-status="${status}" aria-hidden="true"
          class="absolute bottom-0 right-0 z-[var(--lv-z-base)] rounded-[var(--lv-radius-full)] ring-2 ring-[var(--lv-color-bg)] ${switch (status) { case "online" -> "bg-[var(--lv-color-success)]"; case "away" -> "bg-[var(--lv-color-warning)]"; case "busy" -> "bg-[var(--lv-color-destructive)]"; default -> "bg-[var(--lv-color-muted)]"; }}"
          style="width:${statusDotToken};height:${statusDotToken};"
        ></span>
      @endif
    </span>
  @endif
@else
  <%-- PLAIN DISPLAY SPAN (non-interactive) --%>
  <span
    data-slot="avatar"
    data-size="${size}"
    data-shape="${shape}"
    data-variant="${resolvedColor}"
    aria-hidden="${ariaHidden ? "true" : null}"
    aria-label="${frameAriaLabel}"
    class="${frameBase} ${cssClass}"
    style="width:${diamToken};height:${diamToken};"
    $unsafe{dataAttrsMarkup}
    $unsafe{attrs}
  >
    @if(hasImage)
      <img src="${src}" alt="${resolvedAlt}" loading="lazy" class="aspect-square h-full w-full object-cover">
    @elseif(hasInitials)
      <span data-slot="avatar-initials" aria-hidden="true" class="${textSizeClass} font-[var(--lv-font-medium)] leading-none">${resolvedInitials}</span>
    @elseif(hasIcon)
      @template.lievit.icon(name = icon, cssClass = "h-2/5 w-2/5")
    @endif
    @if(renderStatus)
      <span data-slot="avatar-status" data-status="${status}" aria-hidden="true"
        class="absolute bottom-0 right-0 z-[var(--lv-z-base)] rounded-[var(--lv-radius-full)] ring-2 ring-[var(--lv-color-bg)] ${switch (status) { case "online" -> "bg-[var(--lv-color-success)]"; case "away" -> "bg-[var(--lv-color-warning)]"; case "busy" -> "bg-[var(--lv-color-destructive)]"; default -> "bg-[var(--lv-color-muted)]"; }}"
        style="width:${statusDotToken};height:${statusDotToken};"
      ></span>
    @endif
  </span>
@endif

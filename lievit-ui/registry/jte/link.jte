@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui link partial -- a standalone styled anchor: the Filament LinkComponent / the action
  LINK variant rendered as a real <a href>, with an optional leading/trailing Lucide icon and an
  optional trailing badge.

  TIER: STATIC presentational -> JTE partial (ADR-0012 server-first pivot). A link carries no
  client state: it is a plain <a> the browser navigates (middle-click + open-in-new-tab work),
  so the whole thing is server-rendered, zero JS, CSP-clean. lievit-ui folded links into the
  button partial until now; this is the dedicated render for io.lievit.kit.component.LinkView and
  for the action LINK variant, which need an anchor that LOOKS like a link, not a button.

  WHY a separate partial (link vs button): a button is an affordance for an ACTION; a link is an
  affordance for NAVIGATION. shadcn keeps them distinct (Button asChild=<a> is still button-shaped;
  the "link" Button variant is the bridge). Filament's LinkComponent is its own primitive. Here a
  link is a text-coloured anchor (no button chrome), so it reads as a link inline in prose, in a
  toolbar, or as a row action -- exactly the LINK ActionVariant the kit dispatches.

  STRUCTURE (scientific decision rule): two variants drive the colour pair from the tokens so a
  retheme retints every link -- `default` (primary-coloured, underline-on-hover, the shadcn "link"
  button variant) and `muted` (muted-foreground text that goes full-foreground on hover, the
  toolbar / breadcrumb-tail affordance). An optional Lucide glyph composes the icon partial; its
  POSITION is `leading` (default) or `trailing` (iconPosition), matching Filament's icon-position
  knob. An optional trailing badge composes the badge partial (e.g. a "New" count next to the link
  text), so the link + its annotation render as one inline unit. Server-first polymorphism: a blank
  href renders an inert <span> styled identically (the disabled / no-target case), mirroring how
  badge.jte / chip.jte degrade.

  TARGET: when `newTab` is set the anchor opens in a new tab with rel="noopener noreferrer" (the
  LinkView.newTab() / Filament openUrlInNewTab contract); a screen-reader hint is the caller's job
  via the label text, the partial only sets the safe rel.

  A11y: a real focusable <a> with the platform anchor semantics + a focus-visible ring. The icon is
  decorative (aria-hidden, icon partial) -- the link TEXT names the destination, never the glyph
  alone. Colour is never the only signal: the text + the underline-on-hover carry the affordance.

  Params:
    String label        = null       the link text (used when no content slot is supplied).
    gg.jte.Content content           optional rich children; takes precedence over label.
    String href         = null       the link target; blank => inert <span> (no navigation).
    String variant      = "default"  "default" (primary, underlines on hover) | "muted".
    String icon         = null       optional Lucide icon name composed via the icon partial.
    String iconPosition = "leading"  "leading" | "trailing" -- where the icon sits.
    String badge        = null       optional trailing badge text composed via the badge partial.
    String badgeVariant = "secondary"  the trailing badge's variant.
    boolean newTab      = false      open in a new tab (target=_blank + rel=noopener noreferrer).
    String cssClass     = ""         extra utility classes on the link.

  Usage:
    @@template.lievit.link(label = "Vedi tutti", href = "/attivita")
    @@template.lievit.link(label = "Esporta", href = "/export", icon = "download")
    @@template.lievit.link(label = "Documentazione", href = "https://docs", newTab = true,
                   icon = "external-link", iconPosition = "trailing")
    @@template.lievit.link(label = "Inbox", href = "/inbox", badge = "12")
    @@template.lievit.link(variant = "muted", label = "Annulla", href = "/attivita")
--%>
@param String label = null
@param gg.jte.Content content = null
@param String href = null
@param String variant = "default"
@param String icon = null
@param String iconPosition = "leading"
@param String badge = null
@param String badgeVariant = "secondary"
@param boolean newTab = false
@param String cssClass = ""

!{var isLink = href != null && !href.isBlank();}
!{var hasIcon = icon != null && !icon.isBlank();}
!{var iconLeading = !"trailing".equals(iconPosition);}
!{var hasBadge = badge != null && !badge.isBlank();}
!{var color = "muted".equals(variant) ? "var(--lv-color-muted-fg)" : "var(--lv-color-primary)";}
<%-- default mirrors the shadcn "link" affordance (underline on hover); muted darkens to full fg. --%>
!{var hoverClass = "muted".equals(variant) ? "hover:text-[var(--lv-color-fg)]" : "hover:underline";}
!{var linkClass = "lievit-link lievit-link--" + variant + " inline-flex items-center gap-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none no-underline underline-offset-4 transition-colors focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] " + hoverClass + " " + cssClass;}
!{var linkStyle = "font-family:var(--lv-font-sans);color:" + color + ";";}

@if(isLink)
<a
  href="${href}"
  data-slot="link"
  data-variant="${variant}"
  target="${newTab ? "_blank" : null}"
  rel="${newTab ? "noopener noreferrer" : null}"
  class="${linkClass}"
  style="${linkStyle}"
>
  @if(hasIcon && iconLeading)<span data-slot="link-icon" aria-hidden="true" class="inline-flex shrink-0 items-center">@template.lievit.icon(name = icon, size = "1rem")</span>@endif
  <span data-slot="link-label">@if(content != null)${content}@else${label}@endif</span>
  @if(hasIcon && !iconLeading)<span data-slot="link-icon" aria-hidden="true" class="inline-flex shrink-0 items-center">@template.lievit.icon(name = icon, size = "1rem")</span>@endif
  @if(hasBadge)<span data-slot="link-badge" class="inline-flex shrink-0 items-center">@template.lievit.badge(variant = badgeVariant, label = badge)</span>@endif
</a>
@else
<span
  data-slot="link"
  data-variant="${variant}"
  aria-disabled="true"
  class="${linkClass} opacity-50"
  style="${linkStyle}"
>
  @if(hasIcon && iconLeading)<span data-slot="link-icon" aria-hidden="true" class="inline-flex shrink-0 items-center">@template.lievit.icon(name = icon, size = "1rem")</span>@endif
  <span data-slot="link-label">@if(content != null)${content}@else${label}@endif</span>
  @if(hasIcon && !iconLeading)<span data-slot="link-icon" aria-hidden="true" class="inline-flex shrink-0 items-center">@template.lievit.icon(name = icon, size = "1rem")</span>@endif
  @if(hasBadge)<span data-slot="link-badge" class="inline-flex shrink-0 items-center">@template.lievit.badge(variant = badgeVariant, label = badge)</span>@endif
</span>
@endif

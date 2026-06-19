@import gg.jte.Content
@*
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui avatar partial -- a user/entity image with a graceful fallback, sized by token.

  TIER (planning two-tier model): STATIC presentational -> JTE partial. An avatar has no client
  state/behaviour/lifecycle; the image-load fallback is a server decision (we already know if a
  src exists) plus a CSS hide-on-error, so no Lit island is warranted.

  STRUCTURE (scientific decision rule -- compared shadcn/Radix/MUI/Web Awesome):
  shadcn/Radix split Avatar.Root + Avatar.Image + Avatar.Fallback; in JTE that maps to a single
  partial that renders the image when `src` is set and the fallback otherwise (initials or a
  Lucide `user` icon). Radix's value is the JS load-state machine (show fallback only after the
  image fails); server-side we already hold the src, so we render the right branch directly and
  keep a CSS `onerror` swap as the no-JS-state degradation. Customisability (light DOM + Tailwind
  + tokens) and bundle size (zero JS) both favour the partial over an island here.

  A11y (Radix model): the rendered <span> carries role="img" + an aria-label (the person's name),
  so assistive tech announces "image, <name>" whether the photo or the fallback shows. The inner
  <img> is decorative (alt="") because the wrapper already labels it; the fallback initials/icon
  are aria-hidden for the same reason. Decorative-only avatars (no name) pass label="".

  Sizes map to the shadcn scale: sm = 1.5rem, default = 2rem, lg = 2.5rem.

  Params:
    String name           accessible label (the person/entity). "" => purely decorative.
    String src     = null image URL; when null/blank the fallback renders instead.
    String initials = null fallback text (e.g. "FB"); when null/blank a Lucide `user` icon shows.
    String size    = "default"  one of: sm | default | lg.
    String cssClass = ""  extra utility classes on the root (ring, margin for groups, ...).

  Usage:
    @template.avatar(name = "Francesco Bilotta", src = user.avatarUrl(), initials = "FB")
    @template.avatar(name = "Luca Cecchetto", initials = "LC", size = "lg")
    @template.avatar(name = "Unknown agent", size = "sm")               // user icon fallback
    @template.avatar(name = "Francesco", src = url, cssClass = "ring-2 ring-[var(--lv-color-bg)]")

  Avatar group (overlapping stack): wrap calls in a flex row with negative gap and a ring so
  each avatar reads against its neighbour; the ring colour is a page-surface token:
    <div class="flex -space-x-2">
      @template.avatar(name = "A", initials = "A", cssClass = "ring-2 ring-[var(--lv-color-bg)]")
      @template.avatar(name = "B", initials = "B", cssClass = "ring-2 ring-[var(--lv-color-bg)]")
    </div>
*@
@param String name
@param String src = null
@param String initials = null
@param String size = "default"
@param String cssClass = ""

!{var dim = size.equals("sm") ? "1.5rem" : size.equals("lg") ? "2.5rem" : "2rem";}
!{var hasImage = src != null && !src.isBlank();}
!{var hasInitials = initials != null && !initials.isBlank();}

<span
  role="img"
  aria-label="${name}"
  data-slot="avatar"
  data-size="${size}"
  class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--lv-radius-full)] bg-[var(--lv-color-muted-bg)] text-[var(--lv-color-muted-fg)] align-middle select-none ${cssClass}"
  style="width: ${dim}; height: ${dim};"
>
  @if(hasImage)
    <img
      src="${src}"
      alt=""
      aria-hidden="true"
      class="aspect-square h-full w-full object-cover"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
    >
    <span aria-hidden="true" class="absolute inset-0 hidden items-center justify-center text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none">
      @if(hasInitials)
        ${initials}
      @else
        @template.icon(name = "user", cssClass = "h-1/2 w-1/2")
      @endif
    </span>
  @elseif(hasInitials)
    <span aria-hidden="true" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none">${initials}</span>
  @else
    @template.icon(name = "user", cssClass = "h-1/2 w-1/2")
  @endif
</span>

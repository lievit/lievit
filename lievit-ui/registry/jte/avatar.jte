@import gg.jte.Content
<%--
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
  image fails); server-side we already hold the src, so we render the right branch DIRECTLY: the
  partial is CSP-safe by default, with ZERO inline scripts and ZERO inline `on*=` handlers
  (a strict `script-src 'self'` CSP refuses inline handlers silently). Customisability (light DOM
  + Tailwind + tokens) and bundle size (zero JS) both favour the partial over an island here.

  CLIENT-SIDE FALLBACK (opt-in, CSP-safe): if a broken-image swap-to-fallback is still desired,
  the partial renders the initials/icon fallback alongside the <img> (hidden) and tags the wrapper
  with `data-lv-avatar-fallback`. An adopter wires it from their OWN TS module (no inline handler):
    document.querySelectorAll('[data-lv-avatar-fallback] img').forEach((img) => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
        img.nextElementSibling?.removeAttribute('hidden');
      });
    });
  Without that opt-in module the default partial stays inert and CSP-clean.

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
    boolean fallbackOnError = false  when true AND src is set, also render the hidden initials/icon
                          fallback + tag the root `data-lv-avatar-fallback` so an adopter's TS module
                          (see CLIENT-SIDE FALLBACK above) can swap it in on a broken image. Default
                          false keeps the markup minimal and inert.

  Usage:
    @template.lievit.avatar(name = "Francesco Bilotta", src = user.avatarUrl(), initials = "FB")
    @template.lievit.avatar(name = "Luca Cecchetto", initials = "LC", size = "lg")
    @template.lievit.avatar(name = "Unknown agent", size = "sm")               // user icon fallback
    @template.lievit.avatar(name = "Francesco", src = url, cssClass = "ring-2 ring-[var(--lv-color-bg)]")

  Avatar group (overlapping stack): wrap calls in a flex row with negative gap and a ring so
  each avatar reads against its neighbour; the ring colour is a page-surface token:
    <div class="flex -space-x-2">
      @template.lievit.avatar(name = "A", initials = "A", cssClass = "ring-2 ring-[var(--lv-color-bg)]")
      @template.lievit.avatar(name = "B", initials = "B", cssClass = "ring-2 ring-[var(--lv-color-bg)]")
    </div>
--%>
@param String name
@param String src = null
@param String initials = null
@param String size = "default"
@param String cssClass = ""
@param boolean fallbackOnError = false

!{var dim = size.equals("sm") ? "1.5rem" : size.equals("lg") ? "2.5rem" : "2rem";}
!{var hasImage = src != null && !src.isBlank();}
!{var hasInitials = initials != null && !initials.isBlank();}

<span
  role="img"
  aria-label="${name}"
  data-slot="avatar"
  data-size="${size}"
  data-lv-avatar-fallback="${fallbackOnError && hasImage}"
  class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--lv-radius-full)] bg-[var(--lv-color-muted-bg)] text-[var(--lv-color-muted-fg)] align-middle select-none ${cssClass}"
  style="width: ${dim}; height: ${dim};"
>
  @if(hasImage)
    <img
      src="${src}"
      alt=""
      aria-hidden="true"
      class="aspect-square h-full w-full object-cover"
    >
    @if(fallbackOnError)
      <span aria-hidden="true" hidden class="absolute inset-0 flex items-center justify-center text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none">
        @if(hasInitials)
          ${initials}
        @else
          @template.lievit.icon(name = "user", cssClass = "h-1/2 w-1/2")
        @endif
      </span>
    @endif
  @elseif(hasInitials)
    <span aria-hidden="true" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none">${initials}</span>
  @else
    @template.lievit.icon(name = "user", cssClass = "h-1/2 w-1/2")
  @endif
</span>

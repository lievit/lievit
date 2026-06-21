@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui avatar/badge partial -- the small status dot that overlaps an avatar's corner
  (shadcn new-york-v4 AvatarBadge, data-slot="avatar-badge"): an online/notification indicator.

  TIER: STATIC presentational -> JTE partial. The dot's presence + colour are a server fact
  (the user IS online, there ARE N notifications), so no client state: server-rendered, zero JS.

  STRUCTURE (scientific decision rule): shadcn's AvatarBadge is an absolutely-positioned round tile
  in the avatar's bottom-right, filled with a token pair and ringed with the page surface so it
  reads off the photo. Because our avatar partial is overflow-hidden (it clips the photo to a
  circle), the badge cannot live INSIDE it; the adopter wraps the avatar in a `relative` span and
  drops this badge as a sibling, exactly the shadcn Root>Badge nesting expressed server-first.
  The fill defaults to the primary token (shadcn's bg-primary); an optional content slot carries a
  tiny glyph or count, else the dot is a plain status indicator.

  A11y: a status dot is decorative unless it carries meaning; pass a non-blank `label` to announce
  it (role="img" + aria-label, e.g. "Online"), else it is aria-hidden so it adds no noise.

  Params:
    String size    = "default"  one of: sm | default | lg (match the avatar it sits on).
    String label   = ""  accessible label (e.g. "Online"); "" => decorative (aria-hidden).
    gg.jte.Content content = null  optional tiny glyph / count inside the dot.
    String cssClass = ""  extra utility classes (e.g. a status fill: bg-[var(--lv-color-success)]).

  Usage: wrap the avatar in a relative span, drop the badge as a sibling.
    <span class="relative inline-block">
      @@template.lievit.avatar(name = "Ada", initials = "A")
      @@template.lievit.avatar.badge(label = "Online", cssClass = "bg-[var(--lv-color-success)]")
    </span>
--%>
@param String size = "default"
@param String label = ""
@param gg.jte.Content content = null
@param String cssClass = ""

!{var dim = size.equals("sm") ? "0.5rem" : size.equals("lg") ? "0.75rem" : "0.625rem";}
!{var labelled = label != null && !label.isBlank();}

<span
  data-slot="avatar-badge"
  data-size="${size}"
  role="${labelled ? "img" : null}"
  aria-label="${labelled ? label : null}"
  aria-hidden="${labelled ? null : "true"}"
  class="absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-[var(--lv-radius-full)] bg-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)] ring-2 ring-[var(--lv-color-bg)] select-none leading-none text-[length:var(--lv-text-xs)] ${cssClass}"
  style="width: ${dim}; height: ${dim}; min-width: ${dim};"
>@if(content != null)${content}@endif</span>

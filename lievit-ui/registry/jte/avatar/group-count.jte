<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui avatar/group-count partial -- the "+N" overflow tile that closes an overlapping
  avatar stack (shadcn new-york-v4 AvatarGroupCount, data-slot="avatar-group-count").

  TIER: STATIC presentational -> JTE partial. The overflow count is a server fact (the server
  already knows how many avatars it did NOT render), so there is no client state: the whole tile
  is server-rendered, zero JS, CSP-clean.

  STRUCTURE (scientific decision rule): shadcn renders AvatarGroupCount as a muted, round tile the
  same diameter as the avatars it sits beside, carrying the same ring as the group's other tiles so
  it reads as a member of the overlapping stack. We reproduce that with the same muted-bg/muted-fg
  token pair avatar/kbd/empty use and the avatar size scale (sm/default/lg -> the same dims).

  A11y: the tile states the count in text (e.g. "+3"); it is not interactive and carries no role.
  If the count links to a "see all" view the ADOPTER wraps the call in an <a>.

  Params:
    int    count    overflow count rendered as "+<count>".
    String size    = "default"  one of: sm | default | lg (mirror the sibling avatars' size).
    String cssClass = ""  extra utility classes (e.g. the group ring: ring-2 ring-[var(--lv-color-bg)]).

  Usage:
    <div class="flex -space-x-2">
      @@template.lievit.avatar(name = "A", initials = "A", cssClass = "ring-2 ring-[var(--lv-color-bg)]")
      @@template.lievit.avatar(name = "B", initials = "B", cssClass = "ring-2 ring-[var(--lv-color-bg)]")
      @@template.lievit.avatar.group-count(count = 3, cssClass = "ring-2 ring-[var(--lv-color-bg)]")
    </div>
--%>
@param int count
@param String size = "default"
@param String cssClass = ""

!{var dim = size.equals("sm") ? "1.5rem" : size.equals("lg") ? "2.5rem" : "2rem";}

<span
  data-slot="avatar-group-count"
  data-size="${size}"
  class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--lv-radius-full)] bg-[var(--lv-color-muted-bg)] text-[var(--lv-color-muted-fg)] align-middle select-none text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none ${cssClass}"
  style="width: ${dim}; height: ${dim}; font-family:var(--lv-font-sans);"
>+${count}</span>

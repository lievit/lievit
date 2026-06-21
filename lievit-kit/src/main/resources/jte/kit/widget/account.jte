@import io.lievit.kit.AccountWidget
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.widget.account - renders the io.lievit.kit.AccountWidget (the Filament
  AccountWidget): a dashboard card greeting the authenticated user by name, with their avatar and a
  quick-links menu to the profile page. It is the dashboard twin of the topbar user menu.

  The AccountWidget carries: heading() (the greeting, e.g. "Welcome back"), value() (the user's
  display name), avatarUrl() (the avatar image, optional -> initials/user-icon fallback), profileUrl()
  (the profile-page link, optional).

  The mapping, composing three lievit-ui primitives:
    avatar      -> lievit-ui avatar (image when avatarUrl() is set, else the initials of value())
    greeting+name -> the card heading (greeting) over the name (value)
    quick links -> a lievit-ui dropdown-menu (the "...") whose items are real <a href> to the profile
                   page; when there is no profileUrl(), a lievit-ui link affordance is rendered inline
                   instead of the menu (a single quick action does not warrant a dropdown).

  Server-first, token-driven, strict-CSP clean: the avatar + link + dropdown are all server-rendered
  partials, the menu is the native-popover dropdown (zero inline script). Params: account.
--%>
@param AccountWidget account
!{var name = account.value();}
!{var initials = name.isBlank() ? "?" : name.trim().substring(0, 1).toUpperCase(java.util.Locale.ROOT);}
<div
  data-slot="kit-widget-account"
  class="flex items-center justify-between gap-[var(--lv-space-4)] rounded-[var(--lv-radius-xl)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] p-[var(--lv-space-6)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-xs)]"
  style="font-family:var(--lv-font-sans);"
>
  <div data-slot="kit-widget-account-identity" class="flex items-center gap-[var(--lv-space-3)]">
    @template.lievit.avatar(name = name, src = account.avatarUrl().orElse(null), initials = initials, size = "lg")
    <div class="flex flex-col">
      <span data-slot="kit-widget-account-greeting" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">${account.heading()}</span>
      <span data-slot="kit-widget-account-name" class="text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-tight text-[var(--lv-color-card-fg)]">${name}</span>
    </div>
  </div>

  @if(account.profileUrl().isPresent())
    <div data-slot="kit-widget-account-actions">
      @template.lievit.dropdown-menu(
        id = "kit-account-menu",
        trigger = @`@template.lievit.icon(name = "ellipsis-vertical", size = "1rem", label = "Account menu")`,
        content = @`
          @template.lievit.dropdown-menu.item(href = account.profileUrl().get(), label = "Profile", icon = "user")
        `)
    </div>
  @endif
</div>

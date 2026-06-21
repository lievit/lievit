@import java.util.Map
@import io.lievit.kit.page.KitPageView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.user-menu - the Filament topbar USER MENU (fi-user-menu), rendered from a
  KitPageView onto the lievit-ui dropdown-menu + avatar + dropdown-menu/{item,separator,label} +
  theme-switcher partials. The Filament components/user-menu.blade: a trigger (avatar + optional name
  + chevron) opening a dropdown with an optional profile header, the configured menu items, a theme
  switcher row (when the panel has dark mode on), and the always-present logout item.

  The user-menu rows are server-projected by KitPageComponent.userMenu(logoutAction): each is a link
  item (key `href`), a submit item (key `formAction`, e.g. the logout form), or a separator (key
  `separator`="true"); an item may carry `icon` + `variant`="destructive" (the logout / a danger
  item). The theme switcher renders only when the panel offers it (page.hasThemeSwitcher()).

  Server-first / strict-CSP: the dropdown-menu partial is a native HTML popover (zero JS, light-
  dismiss + Escape for free); items are real <a href> / <button formaction> (the logout posts the
  adopter's logout form JS-off); the theme-switcher is a server-rendered radiogroup whose ONE client
  bit (persisting the OS-scheme choice) rides its own CSP-clean data-* enhancer, never inline script.

  Params:
    page - the KitPageView render bundle (read .userName() + .avatarSrcOrNull() + .userInitials() +
           .userMenu() + theme facts).
--%>
@param KitPageView page
@template.lievit.dropdown-menu(
  id = "kit-page-user-menu",
  placement = "bottom",
  cssClass = "shrink-0",
  trigger = @`
    <span class="flex items-center gap-[var(--lv-space-2)]">
      @template.lievit.avatar(name = page.userName(), src = page.avatarSrcOrNull(),
        initials = page.userInitials().isBlank() ? null : page.userInitials(), size = "sm")
      <span class="hidden text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] md:inline">${page.userName()}</span>
      @template.lievit.icon(name = "chevron-down", cssClass = "text-[var(--lv-color-muted-fg)]")
    </span>
  `,
  content = @`
    <%-- Profile header: the signed-in identity, the Filament user-menu profile block. --%>
    @template.lievit.dropdown-menu.label(label = page.userName())
    @template.lievit.dropdown-menu.separator()
    @for(Map<String, String> mi : page.userMenu())
      @if("true".equals(mi.get("separator")))
        @template.lievit.dropdown-menu.separator()
      @else
        @template.lievit.dropdown-menu.item(
          label = mi.getOrDefault("label", ""),
          href = mi.getOrDefault("href", ""),
          icon = mi.getOrDefault("icon", ""),
          variant = "destructive".equals(mi.get("variant")) ? "destructive" : "default",
          formAction = mi.getOrDefault("formAction", "")
        )
      @endif
    @endfor
    <%-- Theme switcher row: light / dark / system, the Filament theme-switcher, shown only when the
         panel offers dark mode. It is a non-menuitem control inside the menu (a settings row). --%>
    @if(page.hasThemeSwitcher())
      @template.lievit.dropdown-menu.separator()
      <div data-slot="kit-page-theme-row" role="presentation" class="flex items-center justify-between gap-[var(--lv-space-2)] px-[var(--lv-space-3)] py-[var(--lv-space-2)]">
        <span class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">Theme</span>
        @template.lievit.theme-switcher(current = page.themeMode(), label = "Theme")
      </div>
    @endif
  `
)

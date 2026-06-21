@import io.lievit.kit.page.KitToastView
@import io.lievit.kit.NotificationAction
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.notification.toast - the canonical Filament FLASH notification chrome, rendered
  from a KitToastView (a flashed io.lievit.kit.AdminNotification) onto the lievit-ui toast partial.
  The render-counterpart of the table chrome: a host renders THIS when a flash exists, instead of
  hand-mapping the notification model onto the toast.

  The map (AdminNotification -> lievit-ui toast):
    - level (success/info/warning/danger) -> toast `variant`. The toast itself derives its severity
      colour + role (alert vs status) + leading glyph from that one variant, so the heroicon-style
      stored AdminNotification.icon() is NOT passed through (it is not in the lievit Lucide set); the
      variant IS the icon decision. KitToastView.variant() does the level->variant mapping.
    - title -> toast `heading` (the bold line).
    - body  -> toast `content` (the message body); empty when the notification has no body.
    - persistent / duration -> the toast auto-dismiss: a persistent notification stays until
      dismissed (duration 0), else the notification's duration() in ms drives the enhancer timer.
    - position -> toast `position` (one of the six sonner corners).
    - actions -> rendered inside the toast body as token-styled, server-first affordances: a url
      action is a real <a href> (rel=noopener on a new tab); a non-url action (close / dispatch) is
      a plain control the host's toast enhancer wires by data-* (CSP-clean, never inline on*).

  The live-push variant (BroadcastNotification over SSE) renders the SAME toast on the client from the
  same AdminNotification.toMap() detail; that is a RUNTIME concern (the broadcast channel), not a
  template. This template is the server-side flash render only.

  Params:
    toast - the KitToastView render bundle (the flashed AdminNotification + the level->variant map).
--%>
@param KitToastView toast
@template.lievit.toast(
  variant = toast.variant(),
  heading = toast.title(),
  duration = toast.isPersistent() ? 0 : toast.duration(),
  position = toast.position(),
  content = @`
    @if(toast.hasBody())
      <div data-slot="kit-toast-body">${toast.body()}</div>
    @endif
    @if(toast.hasActions())
      <div data-slot="kit-toast-actions" class="mt-[var(--lv-space-2)] flex flex-wrap items-center gap-[var(--lv-space-2)]">
        @for(NotificationAction action : toast.actions())
          @if(action.url() != null && !action.url().isEmpty())
            <a href="${action.url()}"
               data-toast-action="${action.name()}"
               rel="${action.opensUrlInNewTab() ? "noopener noreferrer" : null}"
               target="${action.opensUrlInNewTab() ? "_blank" : null}"
               class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-primary)] underline-offset-2 hover:underline">${action.label()}</a>
          @else
            <button type="button"
               data-toast-action="${action.name()}"
               data-toast-close="${action.closesNotification() ? "true" : null}"
               data-toast-dispatch="${action.dispatch()}"
               class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-primary)]"
               style="background:transparent;border:0;padding:0;cursor:pointer;font:inherit;">${action.label()}</button>
          @endif
        @endfor
      </div>
    @endif
  `)

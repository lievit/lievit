@import io.lievit.kit.page.KitToastView
@import io.lievit.kit.NotificationAction
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.notification.toast - the canonical Filament FLASH notification chrome, rendered
  from a KitToastView (a flashed io.lievit.kit.AdminNotification) onto the lievit-ui toast partial.

  v-next migration: the toast partial simplified its API.
  - position= removed (position is now a CSS concern / toaster-host concern, not per-toast).
  - content= Content slot removed; body text goes into description= (String).
  - Only ONE action is supported (action= / actionHref= or actionWireClick=).
    The kit's multi-action list maps only the FIRST url-action or wire-action; others are dropped.

  Params:
    toast - the KitToastView render bundle (the flashed AdminNotification + the level->variant map).
--%>
@param KitToastView toast
!{var firstAction = toast.hasActions() ? toast.actions().get(0) : null;}
!{String actionLabel = firstAction != null ? firstAction.label() : null;}
!{String actionHref = (firstAction != null && firstAction.url() != null && !firstAction.url().isEmpty()) ? firstAction.url() : null;}
!{String actionWireClick = (firstAction != null && actionHref == null && firstAction.dispatch() != null) ? firstAction.dispatch() : null;}
@template.lievit.toast(
  variant = toast.variant(),
  message = toast.title(),
  description = toast.hasBody() ? toast.body() : null,
  duration = toast.isPersistent() ? 0 : toast.duration(),
  action = actionLabel,
  actionHref = actionHref,
  actionWireClick = actionWireClick)

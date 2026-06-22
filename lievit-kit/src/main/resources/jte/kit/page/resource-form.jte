@import io.lievit.kit.AdminFormView
@import io.lievit.kit.GlobalSearchResults
@import io.lievit.kit.page.KitFormView
@import io.lievit.kit.page.KitPageView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.resource-form - the Filament resource CREATE / EDIT PAGE (CreateRecord /
  EditRecord): the panel SHELL (kit/page.jte) wrapping the canonical form chrome. The page is shell +
  body: this template owns only the shell wrapping; the form body is composed from the dedicated form
  builder (kit/form.jte), which renders the AdminFormView onto the lievit-ui field / control partials
  with the per-field type dispatch, the record-error region, and the submit / cancel footer.

  HISTORY (the Phase-2 reconcile): this page used to render the form INLINE (the field loop + control
  dispatch) because it was built before the dedicated form builder existed. It now COMPOSES
  kit/form.jte so there is ONE place that renders a Filament form (the kit-render pattern, twin of
  resource-list -> kit/table). The CSRF hidden field is injected into the builder's form body slot so
  the native <form> still posts JS-off under strict CSP.

  Params:
    page    - the KitPageView panel-chrome bundle.
    form    - the AdminFormView (heading / fields / recordErrors / editing).
    action  - the form POST target (the resource create / update route).
    cancelUrl - the cancel link target (back to the list); "" hides the cancel link.
    csrf    - the hidden CSRF field slot (Spring: @`<input type="hidden" name="${_csrf.parameterName}" value="${_csrf.token}">`).
    searchResults - server-prefetched grouped global-search hits for the topbar; null => GET-only.
--%>
@param KitPageView page
@param AdminFormView form
@param String action
@param String cancelUrl = ""
@param gg.jte.Content csrf = null
@param GlobalSearchResults searchResults = null
!{var formView = KitFormView.of(form, action).withCancelUrl(cancelUrl == null ? "" : cancelUrl);}
@template.kit.page(
  page = page,
  searchResults = searchResults,
  content = @`
    @template.kit.form(form = formView, csrf = csrf)
  `)

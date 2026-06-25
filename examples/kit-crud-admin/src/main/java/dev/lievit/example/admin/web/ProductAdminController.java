/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.example.admin.web;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.ModelAndView;

import dev.lievit.example.admin.product.Product;
import dev.lievit.example.admin.product.ProductResource;
import dev.lievit.example.admin.product.ProductSearchComponent;
import dev.lievit.kit.AdminFormView;
import dev.lievit.kit.AdminListView;
import dev.lievit.kit.AdminRoutes;
import dev.lievit.kit.FieldError;
import dev.lievit.kit.RecordRepository;
import dev.lievit.kit.SaveResult;
import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;

/**
 * The CRUD controller for the {@link ProductResource}. lievit-kit ships no HTTP routes by design; the
 * adopter wires them. This controller turns the resource into the kit's {@code AdminListView} /
 * {@code AdminFormView} view-models and renders them with JTE templates, following the Filament route
 * shape captured by {@link AdminRoutes} ({@code /{panel}/{slug}} list, {@code .../create},
 * {@code .../{id}/edit}).
 */
@Controller
public class ProductAdminController {

    /** The panel id used in the route prefix and the {@link AdminRoutes} shape. */
    static final String PANEL = "admin";

    private static final int PAGE_SIZE = 5;

    private final ProductResource resource;
    private final RecordRepository<Product> repository;
    private final LievitWireService wireService;
    private final AdminRoutes routes;

    public ProductAdminController(
            ProductResource resource,
            RecordRepository<Product> repository,
            LievitWireService wireService) {
        this.resource = resource;
        this.repository = repository;
        this.wireService = wireService;
        this.routes = AdminRoutes.of(PANEL, resource);
    }

    /** GET /admin/products — the list page, plus the reactive search island mounted server-side. */
    @GetMapping("/admin/products")
    public String list(@RequestParam(defaultValue = "1") int page, Model model) {
        AdminListView view = AdminListView.of(resource, page, PAGE_SIZE);
        model.addAttribute("view", view);
        model.addAttribute("routes", routes);

        // Mount the lievit search component server-side: initial HTML (with the wire markers
        // data-lievit-id + data-lievit-snapshot stamped on the root) + the signed snapshot.
        WireCallResult search =
                wireService.mountStamped(ProductSearchComponent.class.getName(), Map.of());
        model.addAttribute("searchHtml", search.html());
        model.addAttribute("searchSnapshot", search.snapshot());
        return "admin/list";
    }

    /** GET /admin/products/create — the empty create form. */
    @GetMapping("/admin/products/create")
    public String createForm(Model model) {
        AdminFormView form = AdminFormView.of(resource.form(), false, Map.of(), List.of());
        model.addAttribute("form", form);
        model.addAttribute("routes", routes);
        model.addAttribute("action", routes.create());
        return "admin/form";
    }

    /** POST /admin/products/create — persist a new product (or re-render the form with errors). */
    @PostMapping("/admin/products/create")
    public ModelAndView create(@RequestParam Map<String, String> params) {
        return save(null, params);
    }

    /** GET /admin/products/{id}/edit — the edit form, pre-filled from the record. */
    @GetMapping("/admin/products/{id}/edit")
    public String editForm(@PathVariable String id, Model model) {
        Product record = repository.findById(id).orElseThrow();
        Map<String, String> values = resource.form().binder().toState(record);
        AdminFormView form = AdminFormView.of(resource.form(), true, values, List.of());
        model.addAttribute("form", form);
        model.addAttribute("routes", routes);
        model.addAttribute("action", routes.edit(id));
        return "admin/form";
    }

    /** POST /admin/products/{id}/edit — persist changes (or re-render the form with errors). */
    @PostMapping("/admin/products/{id}/edit")
    public ModelAndView edit(@PathVariable String id, @RequestParam Map<String, String> params) {
        return save(id, params);
    }

    /** POST /admin/products/{id}/delete — remove the product, back to the list. */
    @PostMapping("/admin/products/{id}/delete")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        repository.delete(id);
        return seeOther(routes.list());
    }

    /**
     * The shared write path: {@code Form#save} validates the bound record and persists it, or returns
     * the field errors that blocked the save. On success we redirect to the list (Post/Redirect/Get)
     * with {@code 303 See Other}; on failure we re-render the form view-model carrying the errors with
     * {@code 422 Unprocessable Content}.
     *
     * <p>The two status codes are the Turbo Drive form contract (ADR-0085): a successful POST MUST
     * redirect (303), and a 200 carrying the re-rendered form would be silently discarded by Turbo, so
     * the validation-error re-render carries 422 instead. See
     * {@code docs/guide/turbo-backend-contract.md}.
     */
    private ModelAndView save(String id, Map<String, String> params) {
        Map<String, String> state = new HashMap<>(params);
        state.remove("_csrf"); // strip the CSRF token; it is not a form field

        SaveResult<Product> result = resource.form().save(repository, id, state);
        if (result.ok()) {
            // Success → Post/Redirect/Get. 303 (not Spring's default 302) is the Turbo contract and
            // forces the follow-up to be a GET.
            ModelAndView redirect = new ModelAndView("redirect:" + routes.list());
            redirect.setStatus(HttpStatus.SEE_OTHER);
            return redirect;
        }

        // Validation error → re-render the form, but with 422 so Turbo renders it in place. A 200 here
        // would be dropped by Turbo and the user would never see the errors.
        List<FieldError> errors = result.errors();
        AdminFormView form = AdminFormView.of(resource.form(), id != null, state, errors);
        ModelAndView view = new ModelAndView("admin/form", HttpStatus.UNPROCESSABLE_ENTITY);
        view.addObject("form", form);
        view.addObject("routes", routes);
        view.addObject("action", id == null ? routes.create() : routes.edit(id));
        return view;
    }

    /** A {@code 303 See Other} redirect to {@code location} (the Turbo-correct success status). */
    private static ResponseEntity<Void> seeOther(String location) {
        return ResponseEntity.status(HttpStatus.SEE_OTHER).location(URI.create(location)).build();
    }
}

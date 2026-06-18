/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.example.admin.web;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import io.lievit.example.admin.product.Product;
import io.lievit.example.admin.product.ProductResource;
import io.lievit.example.admin.product.ProductSearchComponent;
import io.lievit.kit.AdminFormView;
import io.lievit.kit.AdminListView;
import io.lievit.kit.AdminRoutes;
import io.lievit.kit.FieldError;
import io.lievit.kit.RecordRepository;
import io.lievit.kit.SaveResult;
import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

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
    public String create(@RequestParam Map<String, String> params, Model model) {
        return save(null, params, model);
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
    public String edit(
            @PathVariable String id, @RequestParam Map<String, String> params, Model model) {
        return save(id, params, model);
    }

    /** POST /admin/products/{id}/delete — remove the product, back to the list. */
    @PostMapping("/admin/products/{id}/delete")
    public String delete(@PathVariable String id) {
        repository.delete(id);
        return "redirect:" + routes.list();
    }

    /**
     * The shared write path: {@code Form#save} validates the bound record and persists it, or returns
     * the field errors that blocked the save. On success we redirect to the list (Post/Redirect/Get);
     * on failure we re-render the form view-model carrying the errors.
     */
    private String save(String id, Map<String, String> params, Model model) {
        Map<String, String> state = new HashMap<>(params);
        state.remove("_csrf"); // strip the CSRF token; it is not a form field

        SaveResult<Product> result = resource.form().save(repository, id, state);
        if (result.ok()) {
            return "redirect:" + routes.list();
        }

        List<FieldError> errors = result.errors();
        AdminFormView form = AdminFormView.of(resource.form(), id != null, state, errors);
        model.addAttribute("form", form);
        model.addAttribute("routes", routes);
        model.addAttribute("action", id == null ? routes.create() : routes.edit(id));
        return "admin/form";
    }
}

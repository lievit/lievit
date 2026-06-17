/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.example.dashboard;

import com.iambilotta.lievit.spring.LievitWireService;
import com.iambilotta.lievit.spring.WireCallResult;
import com.iambilotta.lievit.example.notes.NoteListComponent;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the dashboard page (GET /dashboard). Mounts the NoteListComponent server-side and
 * injects the rendered HTML fragment + initial snapshot into the Thymeleaf model, so the
 * browser receives a fully-rendered page with the lievit island already hydrated.
 *
 * <p>This is the recommended mounting pattern for lievit: the server renders the component
 * on first load (SSR), the client takes over subsequent wire calls via the htmx + l:click directives.
 */
@Controller
public class DashboardController {

    private final LievitWireService wireService;

    public DashboardController(LievitWireService wireService) {
        this.wireService = wireService;
    }

    @GetMapping({"/", "/dashboard"})
    public String dashboard(@AuthenticationPrincipal UserDetails user, Model model) {
        model.addAttribute("username", user.getUsername());

        // Mount the NoteListComponent server-side: renders the initial HTML and signs the snapshot.
        WireCallResult mounted = wireService.mount(NoteListComponent.class.getName());
        model.addAttribute("noteListHtml", mounted.html());
        model.addAttribute("noteListSnapshot", mounted.snapshot());

        return "dashboard/dashboard";
    }
}

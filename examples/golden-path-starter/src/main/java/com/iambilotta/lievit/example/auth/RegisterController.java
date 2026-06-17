/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.example.auth;

import com.iambilotta.lievit.spring.LievitWireService;
import com.iambilotta.lievit.spring.WireCallResult;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the Thymeleaf page that hosts the lievit RegisterComponent (GET /register).
 *
 * <p>The component is mounted server-side here (SSR), so the browser receives the initial form HTML
 * already rendered inside the page. This avoids a second HTTP round-trip for the first render and
 * ensures the form is visible immediately without JavaScript (progressive enhancement).
 */
@Controller
public class RegisterController {

    private final LievitWireService wireService;

    public RegisterController(LievitWireService wireService) {
        this.wireService = wireService;
    }

    @GetMapping("/register")
    public String registerPage(Model model) {
        WireCallResult mounted = wireService.mount(RegisterComponent.class.getName());
        model.addAttribute("registerHtml", mounted.html());
        model.addAttribute("registerSnapshot", mounted.snapshot());
        return "auth/register-host";
    }
}

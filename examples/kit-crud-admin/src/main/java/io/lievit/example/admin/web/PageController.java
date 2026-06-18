/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.example.admin.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Serves the login page and redirects the site root to the product list. */
@Controller
public class PageController {

    /** GET /login — the form-login page. */
    @GetMapping("/login")
    public String login() {
        return "login";
    }

    /** GET / — redirect to the admin list. */
    @GetMapping("/")
    public String home() {
        return "redirect:/admin/products";
    }
}

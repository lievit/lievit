/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.example.auth;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the Thymeleaf login page (GET /login).
 * Spring Security handles the POST /login endpoint automatically.
 */
@Controller
public class LoginController {

    @GetMapping("/login")
    public String loginPage() {
        return "auth/login";
    }
}

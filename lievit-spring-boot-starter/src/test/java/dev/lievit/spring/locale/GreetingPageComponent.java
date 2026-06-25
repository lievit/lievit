/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.locale;

import static dev.lievit.dsl.H.div;
import static dev.lievit.dsl.H.span;
import static dev.lievit.dsl.H.text;

import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitLayout;
import dev.lievit.LievitPage;
import dev.lievit.LievitRender;
import dev.lievit.Wire;
import dev.lievit.dsl.Html;

/**
 * A full-page DSL component that resolves a greeting from a {@link MessageSource} in the active
 * locale, proving the locale-pinning round trip (ADR-0037). The render reads
 * {@code LocaleContextHolder.getLocale()} (the language tag rides {@code data-lang}) and the
 * {@code MessageSource} greeting ({@code data-greeting}). With the {@link dev.lievit.component.LocaleListener}
 * active, the locale resolved at mount is pinned into the snapshot memo and restored on every wire
 * update, so the greeting stays in the mount locale even when a later request's {@code Accept-Language}
 * differs.
 */
@LievitComponent
@LievitPage("/greeting")
@LievitLayout("layouts/app")
public class GreetingPageComponent {

    private final MessageSource messages;

    @Wire int bumps = 0;

    public GreetingPageComponent(MessageSource messages) {
        this.messages = messages;
    }

    /** A trivial action so a wire call has something to do; the render is the assertion surface. */
    @LievitAction
    public void bump() {
        this.bumps++;
    }

    @LievitRender
    Html view() {
        var locale = LocaleContextHolder.getLocale();
        String greeting = messages.getMessage("greeting", null, locale);
        return div(
                        span(text(greeting)).attr("data-greeting", ""),
                        span(text(locale.toLanguageTag())).attr("data-lang", ""))
                .attr("data-lievit-label", "greeting");
    }
}

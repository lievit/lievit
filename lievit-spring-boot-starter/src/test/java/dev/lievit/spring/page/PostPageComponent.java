/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.page;

import static dev.lievit.dsl.H.div;
import static dev.lievit.dsl.H.span;
import static dev.lievit.dsl.H.text;

import dev.lievit.LievitComponent;
import dev.lievit.LievitLayout;
import dev.lievit.LievitPage;
import dev.lievit.LievitRender;
import dev.lievit.LievitTitle;
import dev.lievit.Wire;
import dev.lievit.dsl.Html;

/**
 * A full-page DSL component (issue #63/#181): mapped directly to {@code /post/{slug}}, rendered inside
 * the {@code layouts/app} layout with the title {@code "Post"}. The {@code slug} path variable binds
 * to the same-named {@code @Wire} field (the lievit analogue of implicit route-model binding).
 */
@LievitComponent
@LievitPage("/post/{slug}")
@LievitLayout("layouts/app")
@LievitTitle("Post")
public class PostPageComponent {

    @Wire String slug = "";

    @LievitRender
    Html view() {
        return div(span(text(slug)).attr("data-slug", "")).attr("data-lievit-label", "post");
    }
}

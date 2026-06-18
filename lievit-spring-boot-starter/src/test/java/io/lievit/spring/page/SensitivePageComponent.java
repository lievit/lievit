/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.page;

import static io.lievit.dsl.H.div;
import static io.lievit.dsl.H.text;

import io.lievit.LievitComponent;
import io.lievit.LievitLayout;
import io.lievit.LievitMount;
import io.lievit.LievitPage;
import io.lievit.LievitRender;
import io.lievit.LievitTitle;
import io.lievit.component.LievitResponse;
import io.lievit.dsl.Html;

/**
 * A sensitive full-page component (issue #123) that opts out of the browser back-forward cache in its
 * {@code @LievitMount} via {@link LievitResponse#disableBackButtonCache()}, so the page response
 * carries the no-store headers and a back-navigation re-fetches it instead of restoring a stale
 * authenticated view.
 */
@LievitComponent
@LievitPage("/account")
@LievitLayout("layouts/app")
@LievitTitle("Account")
public class SensitivePageComponent {

    @LievitMount
    void mount() {
        LievitResponse.disableBackButtonCache();
    }

    @LievitRender
    Html view() {
        return div(text("account")).attr("data-lievit-label", "account");
    }
}

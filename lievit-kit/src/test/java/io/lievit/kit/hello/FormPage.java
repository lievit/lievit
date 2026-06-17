/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.hello;

import io.lievit.kit.AdminFormView;

/**
 * The shared view contract of the create and edit page components, so one JTE form template can read
 * the view-model off either via {@code _instance} (the view-model is server-derived, not wire-carried:
 * a complex record cannot round-trip the generic-Map snapshot codec).
 */
public interface FormPage {

    /** @return the current form view-model */
    AdminFormView view();
}

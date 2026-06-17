/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * A fixed-option select field: renders as a {@code <select>} element whose options are declared
 * at build time as a list of {@link SelectOption} pairs.
 *
 * <p>Use {@link BelongsToField} when the options come from a related repository (a belongs-to
 * relation); use this class when the option set is static and known at resource-definition time
 * (for example, a status enum or a country list).
 */
public final class SelectField extends Field {

    private final List<SelectOption> options;

    /**
     * Creates a select field with an explicit label and a fixed option list.
     *
     * @param name    the bound field name
     * @param label   the display label
     * @param options the selectable options (non-null, may be empty)
     * @return a new select field
     */
    public static SelectField make(String name, String label, List<SelectOption> options) {
        return new SelectField(name, label, options);
    }

    /**
     * Creates a select field with a humanized label and a fixed option list.
     *
     * @param name    the bound field name
     * @param options the selectable options (non-null, may be empty)
     * @return a new select field
     */
    public static SelectField make(String name, List<SelectOption> options) {
        return new SelectField(name, Field.humanize(name), options);
    }

    private SelectField(String name, String label, List<SelectOption> options) {
        super(name, label);
        this.options = Collections.unmodifiableList(
                List.copyOf(Objects.requireNonNull(options, "options")));
    }

    /**
     * @return the option list in declaration order (unmodifiable)
     */
    public List<SelectOption> options() {
        return options;
    }
}

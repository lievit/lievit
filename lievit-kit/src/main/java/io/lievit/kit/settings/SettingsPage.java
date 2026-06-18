/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.settings;

import java.util.Map;
import java.util.Objects;

import io.lievit.kit.schema.SchemaForm;
import io.lievit.kit.schema.SchemaState;
import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * A schema-driven settings page (the Filament settings page over {@code spatie/laravel-settings},
 * mapped onto the kit schema engine): a first-class admin page whose form is a {@link SchemaForm}
 * backed by a named group in a {@link SettingsStore}.
 *
 * <p>An adopter subclasses it, declares the {@link #slug()} / {@link #label()} / {@link #group()} and
 * builds the {@link #schema()} with the field palette; the page owns the load → hydrate → validate →
 * persist lifecycle:
 *
 * <pre>
 *   class MailSettingsPage extends SettingsPage {
 *       MailSettingsPage(SettingsStore store) { super(store); }
 *       public String slug()  { return "mail-settings"; }
 *       public String label() { return "Mail"; }
 *       public String group() { return "mail"; }
 *       public SchemaForm schema() {
 *           return SchemaForm.create().components(
 *               TextInput.make("from_address").required().email(),
 *               Toggle.make("queue_outbound"));
 *       }
 *   }
 * </pre>
 */
public abstract class SettingsPage {

    private final SettingsStore store;

    /**
     * @param store the settings store the page reads and writes
     */
    protected SettingsPage(SettingsStore store) {
        this.store = Objects.requireNonNull(store, "store");
    }

    /**
     * The url slug for this page (for example {@code "mail-settings"} → {@code /admin/mail-settings}).
     *
     * @return the slug
     */
    public abstract String slug();

    /**
     * The human label shown in navigation and the heading.
     *
     * @return the label
     */
    public abstract String label();

    /**
     * The settings group name in the store (one group per page).
     *
     * @return the group name
     */
    public abstract String group();

    /**
     * Builds the page's schema form (the field palette). Rebuilt per request, the kit way.
     *
     * @return the schema form
     */
    public abstract SchemaForm schema();

    /**
     * Loads the page's saved values and hydrates a fresh schema state from them (the EDIT-operation
     * mount: stored values feed the form's initial state).
     *
     * @return the hydrated state to render the form from
     */
    public SchemaState mount() {
        SchemaForm form = schema().operating(Operation.EDIT, null);
        SchemaState state = SchemaState.of(store.load(group()));
        form.hydrate(state);
        return state;
    }

    /**
     * Validates and persists submitted settings: validate the state through the schema, and on
     * success dehydrate it and save the group to the store. On a validation failure nothing is
     * persisted and the per-field errors are returned for re-render.
     *
     * @param submitted the submitted settings state (a flat key→value map)
     * @return the per-field validation errors (empty on a successful save)
     */
    public Map<String, String> save(Map<String, ?> submitted) {
        Objects.requireNonNull(submitted, "submitted");
        SchemaForm form = schema().operating(Operation.EDIT, null);
        @SuppressWarnings({"unchecked", "rawtypes"})
        SchemaState state = SchemaState.of((Map) submitted);
        Map<String, String> errors = form.validate(state);
        if (!errors.isEmpty()) {
            return errors;
        }
        store.save(group(), form.dehydrate(state));
        return Map.of();
    }

    /** @return the store this page reads and writes */
    protected final SettingsStore store() {
        return store;
    }
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.settings;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.kit.schema.SchemaForm;
import io.lievit.kit.schema.SchemaState;
import io.lievit.kit.schema.TextInput;

/**
 * Specifies schema-driven settings pages: hydrating the form from the store on mount, validating
 * submitted values through the schema (a required field rejects an empty submit), and persisting the
 * dehydrated values back to the store on a valid submit.
 */
class SettingsPageTest {

    static final class MailSettingsPage extends SettingsPage {
        MailSettingsPage(SettingsStore store) {
            super(store);
        }

        @Override
        public String slug() {
            return "mail-settings";
        }

        @Override
        public String label() {
            return "Mail";
        }

        @Override
        public String group() {
            return "mail";
        }

        @Override
        public SchemaForm schema() {
            return SchemaForm.create()
                    .components(TextInput.make("from_address").required(), TextInput.make("reply_to"));
        }
    }

    /**
     * @spec.given a store holding saved mail settings
     * @spec.when  the page mounts
     * @spec.then  the form state is hydrated from the stored values
     */
    @Test
    void it_hydrates_the_form_from_the_store() {
        InMemorySettingsStore store = new InMemorySettingsStore();
        store.save("mail", Map.of("from_address", "noreply@x.test", "reply_to", "hi@x.test"));
        MailSettingsPage page = new MailSettingsPage(store);

        SchemaState state = page.mount();

        assertThat(state.getString("from_address")).isEqualTo("noreply@x.test");
        assertThat(state.getString("reply_to")).isEqualTo("hi@x.test");
    }

    /**
     * @spec.given the mail settings page
     * @spec.when  a valid submit is saved
     * @spec.then  no errors are returned and the dehydrated values land in the store
     */
    @Test
    void it_persists_a_valid_submit() {
        InMemorySettingsStore store = new InMemorySettingsStore();
        MailSettingsPage page = new MailSettingsPage(store);

        Map<String, String> errors =
                page.save(Map.of("from_address", "ops@x.test", "reply_to", "ops@x.test"));

        assertThat(errors).isEmpty();
        assertThat(store.load("mail")).containsEntry("from_address", "ops@x.test");
    }

    /**
     * @spec.given the mail settings page whose from_address is required
     * @spec.when  a submit omits it
     * @spec.then  a field error is returned and nothing is persisted
     */
    @Test
    void it_rejects_an_invalid_submit() {
        InMemorySettingsStore store = new InMemorySettingsStore();
        MailSettingsPage page = new MailSettingsPage(store);

        Map<String, String> errors = page.save(Map.of("from_address", "", "reply_to", "x@y.test"));

        assertThat(errors).containsKey("from_address");
        assertThat(store.load("mail")).isEmpty();
    }
}

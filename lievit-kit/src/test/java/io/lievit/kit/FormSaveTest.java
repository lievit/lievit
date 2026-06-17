/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;

import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link Form} write path: {@link Form#save} maps the submitted string state to a
 * record through the {@link FormBinder}, gates it through submit-time Jakarta validation, and
 * persists it through the {@link RecordRepository} (create when no id, update when an id is given).
 * A validation failure blocks the write and returns the field errors; a read-only form (no binder)
 * refuses to save.
 */
class FormSaveTest {

    record Account(String id, @NotBlank String name) {}

    static final class AccountRepo implements RecordRepository<Account> {
        final List<Account> rows = new ArrayList<>();

        @Override
        public Page<Account> page(Query query) {
            return Page.of(rows, rows.size());
        }

        @Override
        public Optional<Account> findById(String id) {
            return rows.stream().filter(a -> a.id().equals(id)).findFirst();
        }

        @Override
        public Account create(Account record) {
            Account assigned = new Account(String.valueOf(rows.size() + 1), record.name());
            rows.add(assigned);
            return assigned;
        }

        @Override
        public Account update(String id, Account record) {
            Account updated = new Account(id, record.name());
            rows.replaceAll(a -> a.id().equals(id) ? updated : a);
            return updated;
        }

        @Override
        public void delete(String id) {
            rows.removeIf(a -> a.id().equals(id));
        }
    }

    static final FormBinder<Account> BINDER =
            new FormBinder<>() {
                @Override
                public Account toRecord(Account existing, Map<String, String> state) {
                    String id = existing == null ? "" : existing.id();
                    return new Account(id, state.getOrDefault("name", ""));
                }

                @Override
                public Map<String, String> toState(Account record) {
                    Map<String, String> state = new LinkedHashMap<>();
                    state.put("name", record.name());
                    return state;
                }
            };

    static Validator validator() {
        return Validation.buildDefaultValidatorFactory().getValidator();
    }

    /**
     * @spec.given a form with a binder and a repository, and valid create state
     * @spec.when  save is called with no edit id
     * @spec.then  it persists a new record and returns success carrying it
     * @spec.adr   ADR-0008
     */
    @Test
    void save_creates_a_new_record_from_valid_state() {
        AccountRepo repo = new AccountRepo();
        Form<Account> form = Form.<Account>create().field("name").binder(BINDER);

        SaveResult<Account> result = form.save(repo, null, Map.of("name", "Ada"));

        assertThat(result.ok()).isTrue();
        assertThat(result.record().name()).isEqualTo("Ada");
        assertThat(repo.rows).hasSize(1);
    }

    /**
     * @spec.given a form with a validator and a record that fails a @NotBlank constraint
     * @spec.when  save is called
     * @spec.then  it persists nothing and returns failure carrying the field error
     * @spec.adr   ADR-0008
     */
    @Test
    void save_blocks_and_collects_field_errors_when_validation_fails() {
        AccountRepo repo = new AccountRepo();
        Form<Account> form =
                Form.<Account>create()
                        .field("name")
                        .binder(BINDER)
                        .validator(new FormValidator(validator()));

        SaveResult<Account> result = form.save(repo, null, Map.of("name", "  "));

        assertThat(result.ok()).isFalse();
        assertThat(result.errors()).extracting(FieldError::field).contains("name");
        assertThat(repo.rows).isEmpty();
    }

    /**
     * @spec.given a form with a binder, a repository, and an existing record
     * @spec.when  save is called with that record's id
     * @spec.then  it updates the record in place and returns success
     * @spec.adr   ADR-0008
     */
    @Test
    void save_updates_an_existing_record_when_an_id_is_given() {
        AccountRepo repo = new AccountRepo();
        Account seeded = repo.create(new Account("", "old"));
        Form<Account> form = Form.<Account>create().field("name").binder(BINDER);

        SaveResult<Account> result = form.save(repo, seeded.id(), Map.of("name", "new"));

        assertThat(result.ok()).isTrue();
        assertThat(repo.findById(seeded.id()).orElseThrow().name()).isEqualTo("new");
    }

    /**
     * @spec.given a form without a binder (a read-only form)
     * @spec.when  save is attempted
     * @spec.then  it refuses with a clear IllegalStateException (read-only forms cannot save)
     * @spec.adr   ADR-0008
     */
    @Test
    void a_read_only_form_refuses_to_save() {
        Form<Account> form = Form.<Account>create().field("name");

        assertThatThrownBy(() -> form.save(new AccountRepo(), null, Map.of("name", "x")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("read-only");
    }
}

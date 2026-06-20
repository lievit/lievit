/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import jakarta.validation.constraints.NotBlank;

import io.lievit.kit.FormBinder;
import io.lievit.kit.Page;
import io.lievit.kit.RecordRepository;
import io.lievit.kit.RecordRepository.Query;
import io.lievit.kit.Resource;
import io.lievit.kit.Table;

/**
 * Shared fixtures for the action-modal + wizard-action wire ITs: a {@code Message} record, its
 * {@link FormBinder}, and a headless {@link Resource} over an empty repository (the actions under
 * test are non-CRUD modal actions, so the repository is a stub). Kept in one place so the test app
 * and the wire components agree on the row type.
 */
final class ActionFixtures {

    private ActionFixtures() {}

    /** The non-CRUD action target: a message a "Send"/"Notify" modal action composes. */
    record Message(String to, @NotBlank String subject, String body) {}

    /** Binds the modal form state to a {@link Message}. */
    static final FormBinder<Message> BINDER =
            new FormBinder<>() {
                @Override
                public Message toRecord(Message existing, Map<String, String> state) {
                    return new Message(
                            state.getOrDefault("to", ""),
                            state.getOrDefault("subject", ""),
                            state.getOrDefault("body", ""));
                }

                @Override
                public Map<String, String> toState(Message record) {
                    Map<String, String> s = new LinkedHashMap<>();
                    s.put("to", record.to());
                    s.put("subject", record.subject());
                    s.put("body", record.body());
                    return s;
                }
            };

    /** @return a headless resource over an empty repository (the modal action target) */
    static Resource<Message> resource() {
        RecordRepository<Message> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Message> page(Query query) {
                        return Page.of(List.of(), 0);
                    }

                    @Override
                    public Optional<Message> findById(String id) {
                        return Optional.empty();
                    }

                    @Override
                    public Message create(Message record) {
                        return record;
                    }

                    @Override
                    public Message update(String id, Message record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "messages";
            }

            @Override
            public String label() {
                return "Messages";
            }

            @Override
            public Table<Message> table() {
                return Table.<Message>create().column("To", Message::to);
            }
        };
    }
}

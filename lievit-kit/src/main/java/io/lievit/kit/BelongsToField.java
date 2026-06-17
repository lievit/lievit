/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;
import java.util.Objects;
import java.util.function.Function;

/**
 * A belongs-to relation field: a {@code <select>} whose options are loaded at render time from a
 * related {@link RecordRepository}.
 *
 * <p>Unlike {@link SelectField} (which holds a static option list declared at build time), a
 * belongs-to field delegates to a repository so the option set always reflects the current state
 * of the related entity. This is the v0.1 minimum for a many-to-one relation on a form.
 *
 * <p>The adopter supplies:
 * <ul>
 *   <li>a {@link RecordRepository} for the related entity type {@code R}
 *   <li>an extractor for the option's submitted value (usually the id)
 *   <li>an extractor for the option's displayed label
 * </ul>
 *
 * @param <R> the related entity type
 */
public final class BelongsToField<R> extends Field {

    private final RecordRepository<R> relatedRepo;
    private final Function<R, String> optionValue;
    private final Function<R, String> optionLabel;

    /**
     * Creates a belongs-to field with an explicit label.
     *
     * @param name         the bound field name (holds the selected id)
     * @param label        the display label
     * @param relatedRepo  the repository that supplies the related records
     * @param optionValue  extracts the submitted option value (e.g. the id) from a related record
     * @param optionLabel  extracts the displayed option label from a related record
     * @param <R>          the related entity type
     * @return a new belongs-to field
     */
    public static <R> BelongsToField<R> make(
            String name,
            String label,
            RecordRepository<R> relatedRepo,
            Function<R, String> optionValue,
            Function<R, String> optionLabel) {
        return new BelongsToField<>(name, label, relatedRepo, optionValue, optionLabel);
    }

    /**
     * Creates a belongs-to field with a humanized label.
     *
     * @param name         the bound field name
     * @param relatedRepo  the repository that supplies the related records
     * @param optionValue  extracts the submitted option value from a related record
     * @param optionLabel  extracts the displayed option label from a related record
     * @param <R>          the related entity type
     * @return a new belongs-to field
     */
    public static <R> BelongsToField<R> make(
            String name,
            RecordRepository<R> relatedRepo,
            Function<R, String> optionValue,
            Function<R, String> optionLabel) {
        return new BelongsToField<>(name, Field.humanize(name), relatedRepo, optionValue, optionLabel);
    }

    private BelongsToField(
            String name,
            String label,
            RecordRepository<R> relatedRepo,
            Function<R, String> optionValue,
            Function<R, String> optionLabel) {
        super(name, label);
        this.relatedRepo = Objects.requireNonNull(relatedRepo, "relatedRepo");
        this.optionValue = Objects.requireNonNull(optionValue, "optionValue");
        this.optionLabel = Objects.requireNonNull(optionLabel, "optionLabel");
    }

    /**
     * Loads the current option list by calling {@code findAll()} on the related repository.
     *
     * <p>Called at render time, not at build time, so the options are always up to date.
     *
     * @return the related records in repository order
     */
    public List<R> options() {
        return relatedRepo.findAll();
    }

    /**
     * Extracts the submitted option value from a related record.
     *
     * @param related a record returned by {@link #options()}
     * @return the submitted value for that record (used as the {@code <option value="...">})
     */
    public String optionValueOf(R related) {
        return optionValue.apply(related);
    }

    /**
     * Extracts the displayed label from a related record.
     *
     * @param related a record returned by {@link #options()}
     * @return the label for that record (used as the {@code <option>} text content)
     */
    public String optionLabelOf(R related) {
        return optionLabel.apply(related);
    }
}

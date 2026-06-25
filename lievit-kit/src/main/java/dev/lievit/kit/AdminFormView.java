/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The render view-model the kit derives from a {@link Resource}'s {@link Form} for the create / edit
 * page: the heading, one {@link FieldView} per declared field (its label, current string value, and
 * any submit-time errors), and the record-level errors not tied to a single field. Pure data the JTE
 * form template iterates; it carries no engine knowledge.
 *
 * @param heading the form heading
 * @param editing whether this is an edit ({@code true}) or a create ({@code false})
 * @param fields one view per declared form field, in declaration order
 * @param recordErrors the validation errors not tied to a single field (empty when valid)
 */
public record AdminFormView(
        String heading, boolean editing, List<FieldView> fields, List<String> recordErrors) {

    /** Compact constructor: defends the lists. */
    public AdminFormView {
        fields = List.copyOf(fields);
        recordErrors = List.copyOf(recordErrors);
    }

    /**
     * One rendered field: its bound name, display label, type tag (so the template picks the right
     * input), the current string value, any errors against it, and the {@link FieldOptions
     * type-specific render knobs} the flat {@code (name, label, type, value, errors)} tuple cannot
     * carry (the select option list, the textarea row count, the date format, the toggle on/off
     * labels, the relation combobox mode, the island-pending note).
     *
     * <p>The original 5-arg shape is preserved as a delegating secondary constructor (the
     * {@link #FieldView(String, String, String, String, List) overload below} defaults the options
     * to {@link FieldOptions#NONE}), so every existing caller and the {@code type()} contract are
     * untouched; the render layer reads {@link #options()} for the per-type detail and may layer it
     * on after the fact with {@link #withOptions(FieldOptions)}.
     *
     * @param name the bound field name
     * @param label the display label
     * @param type the field's simple type name (e.g. {@code "TextField"}); drives the input markup
     * @param value the current string value (empty on a fresh create)
     * @param errors the submit-time error messages against this field (empty when valid)
     * @param options the type-specific render knobs ({@link FieldOptions#NONE} for a plain text field)
     */
    public record FieldView(
            String name,
            String label,
            String type,
            String value,
            List<String> errors,
            FieldOptions options) {
        /** Compact constructor: defends the error list and never-nulls the options. */
        public FieldView {
            errors = List.copyOf(errors);
            options = options == null ? FieldOptions.NONE : options;
        }

        /**
         * Back-compat secondary constructor: the original 5-arg shape, defaulting the type-specific
         * options to {@link FieldOptions#NONE}. Keeps every pre-existing call site compiling.
         *
         * @param name the bound field name
         * @param label the display label
         * @param type the field's simple type name
         * @param value the current string value
         * @param errors the per-field error messages
         */
        public FieldView(
                String name, String label, String type, String value, List<String> errors) {
            this(name, label, type, value, errors, FieldOptions.NONE);
        }

        /** @return whether this field has at least one error */
        public boolean hasErrors() {
            return !errors.isEmpty();
        }

        /**
         * @return the normalized control tag the render dispatch switches on (e.g. {@code "text"},
         *     {@code "select"}, {@code "combobox"}, {@code "placeholder"}); a convenience shortcut
         *     for {@code options().control()}
         */
        public String control() {
            return options.control();
        }

        /**
         * @param options the type-specific render knobs
         * @return a copy of this field-view carrying the given options
         */
        public FieldView withOptions(FieldOptions options) {
            return new FieldView(name, label, type, value, errors, options);
        }
    }

    /**
     * The type-specific render knobs one {@link FieldView} carries on top of the flat name / label /
     * value tuple, so the form template can render a select's option list, a textarea's row count, a
     * date's format, a toggle's on/off labels, or a relation combobox without re-deriving them from
     * the {@link Field} subclass at render time. Built once by {@link AdminFormView#of} from the
     * declared {@link Field}; {@link #NONE} is the plain-text-input default (a bare {@code <input
     * type="text">}).
     *
     * <p>The {@link #control() control tag} is the discriminator the JTE {@code kit/form/field.jte}
     * switch reads: a normalized token ({@code text} / {@code email} / {@code number} / {@code
     * password} / {@code textarea} / {@code select} / {@code combobox} / {@code belongsTo} / {@code
     * checkbox} / {@code radio} / {@code toggle} / {@code date} / {@code hidden} / {@code
     * placeholder}) decoupled from the Java class name, so a heavy island field type maps to {@code
     * placeholder} with a {@link #note() backflow note} until its lievit-ui primitive ships.
     *
     * @param control the normalized control tag the render switch dispatches on
     * @param inputType the native input {@code type} for the input-family controls (text / email /
     *     number / password); empty otherwise
     * @param options the value+label option list (select / radio); empty otherwise
     * @param rows the textarea visible row count ({@code 0} when not a textarea)
     * @param format the date formatter pattern (empty when none / not a date)
     * @param onLabel the toggle on-state label (empty when none / not a toggle)
     * @param offLabel the toggle off-state label (empty when none / not a toggle)
     * @param searchable whether a relation renders as the searchable combobox (vs plain select)
     * @param multiple whether a relation submits multiple values
     * @param preload whether a searchable relation preloads its catalog (vs lazy server search)
     * @param note a human note shown next to a {@code placeholder} control (the island-pending
     *     backflow message); empty for a fully rendered control
     */
    public record FieldOptions(
            String control,
            String inputType,
            List<SelectOption> options,
            int rows,
            String format,
            String onLabel,
            String offLabel,
            boolean searchable,
            boolean multiple,
            boolean preload,
            String note) {

        /** The plain single-line text input default. */
        public static final FieldOptions NONE =
                new FieldOptions(
                        "text", "text", List.of(), 0, "", "", "", false, false, false, "");

        /** Compact constructor: never-nulls the strings and defends the option list. */
        public FieldOptions {
            control = control == null || control.isBlank() ? "text" : control;
            inputType = inputType == null ? "" : inputType;
            options = List.copyOf(options == null ? List.of() : options);
            format = format == null ? "" : format;
            onLabel = onLabel == null ? "" : onLabel;
            offLabel = offLabel == null ? "" : offLabel;
            note = note == null ? "" : note;
        }

        /** @return whether this field carries a static option list (select / radio) */
        public boolean hasOptions() {
            return !options.isEmpty();
        }

        /** @return whether a backflow note renders (an island-pending placeholder control) */
        public boolean hasNote() {
            return !note.isBlank();
        }

        /**
         * An input-family control (text / email / number / password / tel / url / search).
         *
         * @param inputType the native input {@code type}
         * @return the options
         */
        public static FieldOptions input(String inputType) {
            return new FieldOptions(
                    inputType, inputType, List.of(), 0, "", "", "", false, false, false, "");
        }

        /**
         * A multi-line textarea.
         *
         * @param rows the visible row count
         * @return the options
         */
        public static FieldOptions textarea(int rows) {
            return new FieldOptions(
                    "textarea", "", List.of(), rows, "", "", "", false, false, false, "");
        }

        /**
         * A fixed-option native select.
         *
         * @param options the value+label option list
         * @return the options
         */
        public static FieldOptions select(List<SelectOption> options) {
            return new FieldOptions(
                    "select", "", options, 0, "", "", "", false, false, false, "");
        }

        /**
         * A relation field: a plain native select, or the searchable combobox when {@code searchable}.
         *
         * @param options the related-record options (value = id, label = display)
         * @param searchable whether to render the searchable combobox
         * @param multiple whether the relation is multi-valued
         * @param preload whether the searchable combobox preloads its catalog
         * @return the options
         */
        public static FieldOptions belongsTo(
                List<SelectOption> options,
                boolean searchable,
                boolean multiple,
                boolean preload) {
            return new FieldOptions(
                    searchable ? "combobox" : "belongsTo",
                    "",
                    options,
                    0,
                    "",
                    "",
                    "",
                    searchable,
                    multiple,
                    preload,
                    "");
        }

        /**
         * A boolean toggle switch.
         *
         * @param onLabel the on-state label (may be empty)
         * @param offLabel the off-state label (may be empty)
         * @return the options
         */
        public static FieldOptions toggle(String onLabel, String offLabel) {
            return new FieldOptions(
                    "toggle", "", List.of(), 0, "", onLabel, offLabel, false, false, false, "");
        }

        /**
         * A native date input.
         *
         * @param format the formatter pattern (may be empty)
         * @return the options
         */
        public static FieldOptions date(String format) {
            return new FieldOptions(
                    "date", "", List.of(), 0, format, "", "", false, false, false, "");
        }

        /** A bare hidden input (no field-wrapper chrome). */
        public static final FieldOptions HIDDEN =
                new FieldOptions(
                        "hidden", "hidden", List.of(), 0, "", "", "", false, false, false, "");

        /**
         * A graceful placeholder for a heavy island field type whose lievit-ui primitive is not yet
         * built (file-upload, rich-editor, repeater, ...). Renders a disabled stand-in plus the note.
         *
         * @param note the island-pending backflow message
         * @return the options
         */
        public static FieldOptions placeholder(String note) {
            return new FieldOptions(
                    "placeholder", "", List.of(), 0, "", "", "", false, false, false, note);
        }
    }

    /**
     * Builds the form view-model.
     *
     * @param form the resource's form
     * @param editing whether this is an edit page
     * @param values the current field values keyed by field name (empty on a fresh create)
     * @param errors the submit-time errors to surface (empty when first rendering or when valid)
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminFormView of(
            Form<T> form, boolean editing, Map<String, String> values, List<FieldError> errors) {
        Map<String, List<String>> byField = new LinkedHashMap<>();
        List<String> recordErrors = new ArrayList<>();
        for (FieldError error : errors) {
            if (error.field().isEmpty()) {
                recordErrors.add(error.message());
            } else {
                byField.computeIfAbsent(error.field(), f -> new ArrayList<>()).add(error.message());
            }
        }

        List<FieldView> fieldViews = new ArrayList<>();
        for (Field field : form.fields()) {
            String value = values.getOrDefault(field.name(), "");
            List<String> fieldErrors = byField.getOrDefault(field.name(), List.of());
            fieldViews.add(
                    new FieldView(
                            field.name(),
                            field.label(),
                            field.getClass().getSimpleName(),
                            value,
                            fieldErrors,
                            optionsOf(field)));
        }

        String heading = form.heading() == null ? (editing ? "Edit" : "Create") : form.heading();
        return new AdminFormView(heading, editing, fieldViews, recordErrors);
    }

    /**
     * Derives the {@link FieldOptions type-specific render knobs} for one declared {@link Field},
     * dispatching on its concrete subclass. A bare {@link Field} (the {@code field(name, label)}
     * convenience) and an unknown subclass both fall back to {@link FieldOptions#NONE} (a plain text
     * input), so a form built without typed fields renders unchanged.
     *
     * @param field a declared form field
     * @return its render options
     */
    private static FieldOptions optionsOf(Field field) {
        if (field instanceof TextareaField textarea) {
            return FieldOptions.textarea(textarea.rows());
        }
        if (field instanceof SelectField select) {
            return FieldOptions.select(select.options());
        }
        if (field instanceof BelongsToField<?> relation) {
            List<SelectOption> options = new ArrayList<>();
            if (relation.isSearchable() ? relation.isPreload() : true) {
                for (BelongsToField.ComboOption combo : relation.preloadOptions()) {
                    options.add(SelectOption.of(combo.value(), combo.label()));
                }
            }
            return FieldOptions.belongsTo(
                    options,
                    relation.isSearchable(),
                    relation.isMultiple(),
                    relation.isPreload());
        }
        if (field instanceof DateField date) {
            return FieldOptions.date(date.pattern() == null ? "" : date.pattern());
        }
        if (field instanceof ToggleField toggle) {
            return FieldOptions.toggle(toggle.onLabel(), toggle.offLabel());
        }
        if (field instanceof HasManyField) {
            return FieldOptions.placeholder("field type has-many: island pending");
        }
        // TextField and the bare Field convenience both render as a plain text input.
        return FieldOptions.NONE;
    }

    /**
     * Builds the form view-model for a fresh create page (no values, no errors).
     *
     * @param form the resource's form
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminFormView forCreate(Form<T> form) {
        return of(form, false, Map.of(), List.of());
    }

    /**
     * Builds the form view-model for an edit page, prefilled from an existing record.
     *
     * @param form the resource's form (must carry a {@link FormBinder})
     * @param record the record being edited
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminFormView forEdit(Form<T> form, T record) {
        return of(form, true, form.stateOf(record), List.of());
    }

    /**
     * Re-renders a form view after a failed submit: keeps the submitted values and shows the errors.
     *
     * @param form the resource's form
     * @param editing whether this is an edit page
     * @param submitted the values the user just submitted (kept so they are not lost)
     * @param errors the validation errors that blocked the save (non-empty)
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminFormView withErrors(
            Form<T> form,
            boolean editing,
            Map<String, String> submitted,
            List<FieldError> errors) {
        return of(form, editing, submitted, errors);
    }
}

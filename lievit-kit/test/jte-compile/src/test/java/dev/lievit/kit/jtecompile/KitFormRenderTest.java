/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER gate for the lievit-kit canonical FORM chrome (kit/form.jte + kit/form/field.jte).
 *
 * The precompile smoke (the jte-maven-plugin `generate` goal in this module's pom) proves the
 * template COMPILES against dev.lievit.kit + the lievit-ui partials; it cannot prove the field-type
 * dispatch + the field-wrapper chrome actually RENDER. This does: it builds real AdminFormView /
 * KitFormView fixtures from the kit builders (one form exercising every dispatch branch), source-
 * renders kit/form.jte on the fly (the same gg.jte 3.2.4 compiler, ContentType.Html,
 * DirectoryCodeResolver over the staged target/jte-src tree), and asserts the right control lands
 * per field type.
 */
package dev.lievit.kit.jtecompile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import dev.lievit.kit.AdminFormView;
import dev.lievit.kit.BelongsToField;
import dev.lievit.kit.DateField;
import dev.lievit.kit.FieldError;
import dev.lievit.kit.Form;
import dev.lievit.kit.HasManyField;
import dev.lievit.kit.RecordRepository;
import dev.lievit.kit.SelectField;
import dev.lievit.kit.SelectOption;
import dev.lievit.kit.TextField;
import dev.lievit.kit.TextareaField;
import dev.lievit.kit.ToggleField;
import dev.lievit.kit.page.KitFormView;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class KitFormRenderTest {

    /** The staged template tree: kit/form.jte + kit/form/field.jte + the lievit/* partials. */
    private static final Path JTE_DIR = Path.of("target", "jte-src");

    private static final TemplateEngine ENGINE =
            TemplateEngine.create(new DirectoryCodeResolver(JTE_DIR), ContentType.Html);

    record City(String id, String name) {}

    /** A tiny related repository of cities (the belongs-to relation catalog). */
    private static RecordRepository<City> cityRepo() {
        List<City> all =
                List.of(new City("1", "Parma"), new City("2", "Reggio"), new City("3", "Milano"));
        return new RecordRepository<>() {
            @Override
            public Page<City> page(Query query) {
                int from = Math.min(query.offset(), all.size());
                int to = Math.min(from + query.limit(), all.size());
                return Page.of(all.subList(from, to), all.size());
            }

            @Override
            public Optional<City> findById(String id) {
                return all.stream().filter(c -> c.id().equals(id)).findFirst();
            }

            @Override
            public City create(City record) {
                return record;
            }

            @Override
            public City update(String id, City record) {
                return record;
            }

            @Override
            public void delete(String id) {}
        };
    }

    /** A form exercising EVERY field-type dispatch branch. */
    private static Form<Object> everyFieldForm() {
        return Form.<Object>create()
                .heading("Listing")
                .field(TextField.make("title"))
                .field(TextareaField.make("description").rows(6))
                .field(
                        SelectField.make(
                                "status",
                                List.of(
                                        SelectOption.of("active", "Active"),
                                        SelectOption.of("archived", "Archived"))))
                .field(
                        BelongsToField.make("city", cityRepo(), City::id, City::name)) // plain select
                .field(
                        BelongsToField.make("agent", cityRepo(), City::id, City::name)
                                .preload()) // searchable combobox (preload)
                .field(ToggleField.make("published"))
                .field(DateField.make("listedOn"))
                .field(HasManyField.make("photos", () -> List.of())); // island placeholder
    }

    /** Renders the staged kit/form.jte with the given model. */
    private String render(KitFormView form) {
        Map<String, Object> model = new HashMap<>();
        model.put("form", form);
        StringOutput out = new StringOutput();
        ENGINE.render("kit/form.jte", model, out);
        return out.toString();
    }

    private KitFormView createView(Form<Object> form) {
        return KitFormView.of(AdminFormView.forCreate(form), "/admin/listings/create")
                .withCancelUrl("/admin/listings");
    }

    /**
     * @spec.given a create form with a heading and a text field
     * @spec.when  kit/form.jte renders it through the kit form chrome
     * @spec.then  the heading, the native POST form, the text input + its label, and the footer
     *     submit/cancel action row all land
     */
    @Test
    void renders_the_heading_form_text_input_and_the_footer_actions() {
        String html = render(createView(everyFieldForm()));

        assertTrue(html.contains("Listing"), "heading missing:\n" + html);
        assertTrue(html.contains("action=\"/admin/listings/create\""), "form POST action missing");
        // text field: a real <input> wrapped in the field partial (label + control).
        assertTrue(html.contains("name=\"title\""), "text input name missing");
        assertTrue(html.contains("data-slot=\"field\""), "field-wrapper chrome missing");
        // footer action row: a submit button (Create) + a cancel <a href> back to the list.
        assertTrue(html.contains("data-admin-submit=\"true\""), "submit button missing");
        assertTrue(html.contains("Create"), "default create submit label missing");
        assertTrue(html.contains("data-admin-cancel=\"true\""), "cancel button missing");
        assertTrue(html.contains("/admin/listings"), "cancel href missing");
    }

    /**
     * @spec.given a form with a textarea (6 rows) and a select with two options
     * @spec.when  the form renders
     * @spec.then  the textarea carries rows=6 and the select renders its option list as <option>s
     */
    @Test
    void renders_the_textarea_rows_and_the_select_options() {
        String html = render(createView(everyFieldForm()));

        assertTrue(html.contains("data-slot=\"textarea\""), "textarea control missing:\n" + html);
        assertTrue(html.contains("rows=\"6\""), "textarea row count not threaded");
        assertTrue(html.contains("data-slot=\"native-select\""), "select control missing");
        assertTrue(html.contains("Active") && html.contains("Archived"), "select options missing");
        assertTrue(html.contains("value=\"archived\""), "select option value missing");
    }

    /**
     * @spec.given a plain belongs-to relation and a searchable (preload) belongs-to relation
     * @spec.when  the form renders
     * @spec.then  the plain relation is a native-select of the related rows, the searchable one is the
     *     combobox, and both carry the related-row options (Parma / Reggio / Milano)
     */
    @Test
    void renders_the_plain_relation_as_select_and_the_searchable_relation_as_combobox() {
        String html = render(createView(everyFieldForm()));

        assertTrue(html.contains("name=\"city\""), "plain relation field missing:\n" + html);
        assertTrue(html.contains("data-field-control=\"belongsTo\""), "plain relation control tag wrong");
        assertTrue(html.contains("name=\"agent\""), "searchable relation field missing");
        assertTrue(html.contains("data-field-control=\"combobox\""), "combobox control tag wrong");
        assertTrue(html.contains("data-lievit-combobox"), "combobox control not rendered");
        assertTrue(html.contains("Parma"), "related-row option (Parma) missing");
        assertTrue(html.contains(">Milano<"), "related-row option (Milano) missing");
    }

    /**
     * @spec.given a toggle field and a date field
     * @spec.when  the form renders
     * @spec.then  the toggle renders the switch control and the date the native date-picker input
     */
    @Test
    void renders_the_toggle_as_a_switch_and_the_date_as_a_date_picker() {
        String html = render(createView(everyFieldForm()));

        assertTrue(html.contains("data-slot=\"switch\""), "toggle did not render the switch:\n" + html);
        assertTrue(html.contains("name=\"published\""), "toggle name missing");
        assertTrue(html.contains("data-slot=\"date-picker\""), "date did not render the date-picker");
        assertTrue(html.contains("type=\"date\""), "native date input missing");
    }

    /**
     * @spec.given a has-many field, whose lievit-ui island primitive is not yet built
     * @spec.when  the form renders
     * @spec.then  it renders a graceful disabled placeholder carrying the island-pending backflow note,
     *     never crashing the form
     */
    @Test
    void renders_a_graceful_placeholder_for_an_island_pending_field_type() {
        String html = render(createView(everyFieldForm()));

        assertTrue(html.contains("data-field-control=\"placeholder\""), "placeholder control missing:\n" + html);
        assertTrue(html.contains("island pending"), "island-pending backflow note missing");
        assertTrue(html.contains("data-field-type=\"HasManyField\""), "placeholder field-type marker missing");
    }

    /**
     * @spec.given a hidden field
     * @spec.when  the form renders
     * @spec.then  it renders a bare <input type=hidden> with NO field-wrapper chrome around it
     */
    @Test
    void renders_a_hidden_field_as_a_bare_input_with_no_wrapper() {
        // The top-level field set has no Hidden class yet; the hidden control is produced by the
        // view-model's FieldOptions.HIDDEN, so build the FieldView directly to exercise the branch.
        AdminFormView view =
                new AdminFormView(
                        "Edit",
                        true,
                        List.of(
                                new AdminFormView.FieldView(
                                        "token",
                                        "Token",
                                        "Hidden",
                                        "abc123",
                                        List.of(),
                                        AdminFormView.FieldOptions.HIDDEN)),
                        List.of());
        String html = render(KitFormView.of(view, "/admin/listings/1/edit"));

        assertTrue(html.contains("type=\"hidden\""), "hidden input missing:\n" + html);
        assertTrue(html.contains("name=\"token\""), "hidden input name missing");
        assertTrue(html.contains("value=\"abc123\""), "hidden input value missing");
    }

    /**
     * @spec.given a failed submit with a per-field error and two record-level errors
     * @spec.when  the form re-renders with the errors and the submitted values
     * @spec.then  the per-field error region renders, the first record error is the form-level alert,
     *     the second record error lists below, and the submitted value is kept
     */
    @Test
    void renders_per_field_errors_record_errors_and_keeps_submitted_values() {
        List<FieldError> errors =
                List.of(
                        FieldError.of("title", "must not be blank"),
                        FieldError.of("", "record level A"),
                        FieldError.of("", "record level B"));
        AdminFormView view =
                AdminFormView.withErrors(
                        everyFieldForm(), true, Map.of("title", "Kept Value"), errors);
        String html = render(KitFormView.of(view, "/admin/listings/1/edit"));

        // per-field error (role=alert region from lievit.field) + the kept value.
        assertTrue(html.contains("must not be blank"), "per-field error missing:\n" + html);
        assertTrue(html.contains("value=\"Kept Value\""), "submitted value not kept");
        // form-level error summary (v-next: the form primitive renders all record-level errors
        // in data-slot="form-error"; both "record level A" and "record level B" land there).
        assertTrue(html.contains("record level A"), "form-level record error missing");
        assertTrue(html.contains("data-slot=\"form-error\""), "form-error summary region missing");
        assertTrue(html.contains("record level B"), "second record error not listed");
        // editing => the submit label is Save, not Create.
        assertTrue(html.contains("Save"), "edit submit label (Save) missing");
        assertFalse(html.contains(">Create<"), "create label should not appear on an edit form");
    }
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.test.dx;

import static io.lievit.test.Lievit.test;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.test.LievitTest;

/**
 * Specifies the Filament-style DOMAIN test-DX surface layered on {@link io.lievit.test.LievitTester}
 * (Epic #41 testing-dx): form helpers (#367), table helpers (#369), action/bulk helpers (#371),
 * notification helpers (#375), and schema/wizard helpers (#373). These dogfood the helpers against
 * the form/table/wizard fixtures over the real wire, exactly as an adopter would test their admin.
 */
@LievitTest(classes = DomainTestDxApp.class)
class DomainTestDxIT {

    // ── Form helpers (#367) ─────────────────────────────────────────────────────────────────────

    /**
     * @spec.given a mounted admin form
     * @spec.when  the form is filled with an invalid email and submitted
     * @spec.then  assertHasFormErrors names the email field and assertFormSet reads the live state
     */
    @Test
    void fill_form_then_assert_form_errors_and_state() {
        test(AdminFormComponent.class)
                .mount()
                .fillForm(Map.of("email", "bad", "name", "Alice"))
                .call("save")
                .assertHasFormErrors(List.of("email"))
                .assertFormSet(Map.of("name", "Alice"));
    }

    /**
     * @spec.given a mounted admin form
     * @spec.when  the form is filled with valid values and submitted
     * @spec.then  there are no form errors
     */
    @Test
    void valid_form_has_no_form_errors() {
        test(AdminFormComponent.class)
                .mount()
                .fillForm(Map.of("email", "alice@example.com", "name", "Alice"))
                .call("save")
                .assertHasNoFormErrors();
    }

    /**
     * @spec.given a mounted admin form where vatNumber renders only when business is true
     * @spec.when  the field visibility is asserted before and after toggling business on
     * @spec.then  vatNumber is hidden initially and visible after the reactive change
     */
    @Test
    void form_field_visibility_tracks_a_reactive_toggle() {
        test(AdminFormComponent.class)
                .mount()
                .assertFormFieldExists("email")
                .assertFormFieldHidden("vatNumber")
                .fillForm(Map.of("business", true))
                .call("save")
                .assertFormFieldVisible("vatNumber");
    }

    // ── Notification helpers (#375) ─────────────────────────────────────────────────────────────

    /**
     * @spec.given a mounted admin form filled with valid values
     * @spec.when  save runs and flashes a success toast
     * @spec.then  assertNotified matches the toast message by fragment
     */
    @Test
    void assert_notified_matches_the_success_toast() {
        test(AdminFormComponent.class)
                .mount()
                .fillForm(Map.of("email", "alice@example.com", "name", "Alice"))
                .call("save")
                .assertNotified("Saved");
    }

    /**
     * @spec.given a mounted admin form filled with an invalid email
     * @spec.when  save is attempted (validation halts it before the notify)
     * @spec.then  assertNotNotified holds: no toast was sent
     */
    @Test
    void assert_not_notified_when_validation_halts_the_action() {
        test(AdminFormComponent.class)
                .mount()
                .fillForm(Map.of("email", "bad", "name", "Alice"))
                .call("save")
                .assertNotNotified();
    }

    /**
     * @spec.given a saved admin form that notified "Saved"
     * @spec.when  assertNotified is asserted with a non-matching fragment
     * @spec.then  the AssertionError names the fragment and the messages actually sent
     */
    @Test
    void assert_notified_failure_message_names_the_sent_messages() {
        var tester =
                test(AdminFormComponent.class)
                        .mount()
                        .fillForm(Map.of("email", "alice@example.com", "name", "Alice"))
                        .call("save");

        assertThatThrownBy(() -> tester.assertNotified("Deleted"))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("Deleted")
                .hasMessageContaining("Saved");
    }

    // ── Table helpers (#369) ────────────────────────────────────────────────────────────────────

    /**
     * @spec.given a mounted records table over four rows
     * @spec.when  the table is loaded
     * @spec.then  it shows all four records and counts them by the per-row marker
     */
    @Test
    void load_table_then_see_records_and_count() {
        test(RecordsTableComponent.class)
                .mount()
                .loadTable()
                .assertCanSeeTableRecords(List.of("Anna", "Marco", "Luca", "Bob"))
                .assertCountTableRecords(4);
    }

    /**
     * @spec.given a mounted records table
     * @spec.when  the table is searched for "a"
     * @spec.then  only the matching records are visible and the rest are not
     */
    @Test
    void search_table_filters_the_visible_records() {
        test(RecordsTableComponent.class)
                .mount()
                .searchTable("ar")
                .assertCanSeeTableRecords(List.of("Marco"))
                .assertCanNotSeeTableRecords(List.of("Luca", "Bob"));
    }

    // ── Action helpers (#371) ───────────────────────────────────────────────────────────────────

    /**
     * @spec.given a mounted admin form
     * @spec.when  the save action is called by name with data via callAction
     * @spec.then  it runs and notifies (action-by-name dispatch with data)
     */
    @Test
    void call_action_by_name_with_data_runs_the_action() {
        test(AdminFormComponent.class)
                .mount()
                .callAction("save", Map.of("email", "x@example.com", "name", "Bob"))
                .assertNotified("Saved");
    }

    // ── Schema + wizard helpers (#373) ──────────────────────────────────────────────────────────

    /**
     * @spec.given a mounted two-step wizard at step 1 with the step-1 field empty
     * @spec.when  goToNextWizardStep is attempted without filling the gate field
     * @spec.then  the wizard stays on step 1 (the validation gate blocks the advance)
     */
    @Test
    void wizard_next_step_is_blocked_until_the_step_validates() {
        test(WizardComponent.class)
                .mount()
                .assertWizardCurrentStep(1)
                .goToNextWizardStep()
                .assertWizardCurrentStep(1);
    }

    /**
     * @spec.given a mounted wizard with the step-1 field filled
     * @spec.when  goToNextWizardStep then goToPreviousWizardStep run
     * @spec.then  the wizard advances to step 2 and then back to step 1
     */
    @Test
    void wizard_advances_and_retreats_between_steps() {
        test(WizardComponent.class)
                .mount()
                .fillForm(Map.of("step1Value", "ok"))
                .goToNextWizardStep()
                .assertWizardCurrentStep(2)
                .goToPreviousWizardStep()
                .assertWizardCurrentStep(1);
    }

    /**
     * @spec.given a mounted wizard at step 1
     * @spec.when  schema component existence/visibility is asserted
     * @spec.then  the step-1 field exists on step 1 (the schema component visibility helper)
     */
    @Test
    void schema_component_existence_reflects_the_current_step() {
        test(WizardComponent.class).mount().assertSchemaComponentExists("step1Value");
    }
}

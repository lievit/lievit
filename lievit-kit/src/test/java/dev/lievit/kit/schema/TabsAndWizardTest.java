/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the Tabs and Wizard layout components: tabs carry label/icon/badge and a persist flag;
 * the wizard tracks a current step and gates advancement on the current step's per-step validation.
 */
class TabsAndWizardTest {

    static final class Probe extends SchemaComponent<String, Probe> {
        static Probe at(String path) {
            return new Probe().statePath(path);
        }
    }

    /**
     * @spec.given a Tabs with two tabs, one with an icon and a badge
     * @spec.when  the tabs and their metadata are read
     * @spec.then  the strip exposes the tabs in order with their icon/badge and child schemas
     */
    @Test
    void tabs_carry_label_icon_badge_and_child_schema() {
        Tabs tabs =
                Tabs.make()
                        .tabs(
                                Tabs.Tab.make("General").schema(Probe.at("name")),
                                Tabs.Tab.make("SEO").icon("heroicon-o-globe-alt").badge("3"))
                        .persistTabInQueryString();

        assertThat(tabs.tabs()).extracting(Tabs.Tab::label).containsExactly("General", "SEO");
        assertThat(tabs.tabs().get(1).icon()).isEqualTo("heroicon-o-globe-alt");
        assertThat(tabs.tabs().get(1).badge()).isEqualTo("3");
        assertThat(tabs.tabs().get(0).children()).hasSize(1);
        assertThat(tabs.isPersistInQueryString()).isTrue();
    }

    /**
     * @spec.given a Wizard with two steps, the first valid only when "name" is filled
     * @spec.when  Next is attempted with an empty then a filled name
     * @spec.then  Next is blocked while invalid and advances once valid (per-step gate)
     */
    @Test
    void wizard_next_validates_only_the_current_step_before_advancing() {
        Wizard wizard =
                Wizard.make()
                        .steps(
                                Wizard.Step.make("Account")
                                        .validateUsing(state -> !state.getString("name").isEmpty())
                                        .schema(Probe.at("name")),
                                Wizard.Step.make("Profile").schema(Probe.at("bio")));
        SchemaState state = SchemaState.empty();

        assertThat(wizard.goToNextStep(state)).isFalse();
        assertThat(wizard.currentStep()).isEqualTo(0);

        state.set("name", "Ada");
        assertThat(wizard.goToNextStep(state)).isTrue();
        assertThat(wizard.currentStep()).isEqualTo(1);
    }

    /**
     * @spec.given a wizard advanced to step 2
     * @spec.when  Previous is invoked
     * @spec.then  it returns to step 1 without re-validation
     */
    @Test
    void wizard_previous_returns_without_revalidation() {
        Wizard wizard =
                Wizard.make().steps(Wizard.Step.make("A"), Wizard.Step.make("B"));
        wizard.goToNextStep(SchemaState.empty());

        assertThat(wizard.currentStep()).isEqualTo(1);
        assertThat(wizard.goToPreviousStep()).isTrue();
        assertThat(wizard.currentStep()).isEqualTo(0);
        assertThat(wizard.goToPreviousStep()).isFalse();
    }

    /**
     * @spec.given a step with before/after validation hooks
     * @spec.when  Next advances past it
     * @spec.then  beforeValidation fires always and afterValidation fires only on a valid advance
     */
    @Test
    void wizard_step_fires_validation_hooks() {
        boolean[] before = {false};
        boolean[] after = {false};
        Wizard wizard =
                Wizard.make()
                        .steps(
                                Wizard.Step.make("A")
                                        .beforeValidation(() -> before[0] = true)
                                        .afterValidation(() -> after[0] = true),
                                Wizard.Step.make("B"));

        wizard.goToNextStep(SchemaState.empty());

        assertThat(before[0]).isTrue();
        assertThat(after[0]).isTrue();
    }

    /**
     * @spec.given a wizard with three steps
     * @spec.when  the total and progress are read
     * @spec.then  stepCount reports the total and goToStep jumps directly
     */
    @Test
    void wizard_exposes_progress_and_direct_navigation() {
        Wizard wizard =
                Wizard.make()
                        .steps(Wizard.Step.make("A"), Wizard.Step.make("B"), Wizard.Step.make("C"));

        assertThat(wizard.stepCount()).isEqualTo(3);
        assertThat(wizard.goToStep(2)).isTrue();
        assertThat(wizard.currentStep()).isEqualTo(2);
        assertThat(wizard.goToStep(9)).isFalse();
    }
}

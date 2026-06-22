/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link KitTableLabels} i18n seam: a plain value object the host populates so the kit
 * table chrome renders non-English copy without forking the template. {@link KitTableLabels#DEFAULT}
 * carries the English text (zero behaviour change when not supplied), and the count / page templates
 * fill positional arguments so word order survives translation.
 */
class KitTableLabelsTest {

    /**
     * @spec.given the default labels
     * @spec.when  the chrome strings are read
     * @spec.then  they are the original English copy
     */
    @Test
    void the_default_labels_are_the_original_english_copy() {
        KitTableLabels labels = KitTableLabels.DEFAULT;

        assertThat(labels.columns()).isEqualTo("Columns");
        assertThat(labels.search()).isEqualTo("Search...");
        assertThat(labels.noResults()).isEqualTo("No results");
        assertThat(labels.resetAll()).isEqualTo("Reset all");
        assertThat(labels.actions()).isEqualTo("Actions");
    }

    /**
     * @spec.given the default results-count template
     * @spec.when  it is rendered with first/last/total
     * @spec.then  it produces the "Showing X to Y of Z results" line
     */
    @Test
    void the_results_count_template_fills_its_positional_arguments() {
        assertThat(KitTableLabels.DEFAULT.resultsCount(1, 3, 7))
                .isEqualTo("Showing 1 to 3 of 7 results");
    }

    /**
     * @spec.given an Italian results-count template with a different word order
     * @spec.when  it is rendered with first/last/total
     * @spec.then  the positional arguments land in the Italian order, proving the seam survives i18n
     */
    @Test
    void a_translated_count_template_reorders_the_arguments() {
        KitTableLabels it =
                new KitTableLabels(
                        "Cerca...", "Cerca", "Pulisci", "Filtri", "Colonne", "Azzera tutto",
                        "Azioni", "Modifica", "Nessun risultato", "Risultati %3$s, da %1$s a %2$s",
                        "Per pagina", "Precedente", "Successivo", "Pagina %s di %s", "Elimina selezionati",
                        "Nuovo", "Salva come nuova vista", "Aggiorna questa vista", "Imposta predefinita",
                        "Elimina vista", "Salva vista", "Modifiche non salvate", "Altro");

        assertThat(it.columns()).isEqualTo("Colonne");
        assertThat(it.resultsCount(1, 3, 7)).isEqualTo("Risultati 7, da 1 a 3");
        assertThat(it.page(2, 5)).isEqualTo("Pagina 2 di 5");
    }

    /**
     * @spec.given labels constructed with null fields
     * @spec.when  the compact constructor normalises them
     * @spec.then  each null falls back to the English default (never null)
     */
    @Test
    void null_fields_fall_back_to_the_english_default() {
        KitTableLabels labels =
                new KitTableLabels(
                        null, null, null, null, null, null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null, null);

        assertThat(labels.columns()).isEqualTo("Columns");
        assertThat(labels.page()).isEqualTo("Page %s of %s");
    }

    /**
     * @spec.given the default labels
     * @spec.when  only the Columns label is overridden through the wither
     * @spec.then  Columns changes and every other label stays English
     */
    @Test
    void the_columns_wither_overrides_only_that_label() {
        KitTableLabels labels = KitTableLabels.DEFAULT.withColumns("Colonne");

        assertThat(labels.columns()).isEqualTo("Colonne");
        assertThat(labels.search()).isEqualTo("Search...");
    }
}

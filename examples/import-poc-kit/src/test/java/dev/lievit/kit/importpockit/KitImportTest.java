/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RFC 0036 full-chain proof: renders poc-kit.jte (a consumer template that calls
 * @template.kit.widget.stat, which itself calls @template.lievit.stat-card) via the
 * precompiled TemplateEngine and asserts both the kit chrome AND the lievit-ui primitive.
 *
 * What this proves:
 *   - ONE lievit-maven-plugin:stage-templates execution staged lievit/ AND kit/ from
 *     two separate jars (lievit-ui + lievit-kit) into one jte-src tree.
 *   - kit->lievit template composition compiles and renders correctly from imported jars.
 *   - This is exactly the import topology gest will use (lievit-ui + lievit-kit as deps,
 *     one plugin execution, one precompile, templates compose at render time).
 */
package dev.lievit.kit.importpockit;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import dev.lievit.kit.StatWidget;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class KitImportTest {

  /**
   * @spec.given a precompiled TemplateEngine loaded from the classpath (lievit-ui jar +
   *             lievit-kit jar + poc-kit's own precompiled classes), and a poc-kit.jte template
   *             that calls @template.kit.widget.stat (a kit template from lievit-kit jar)
   *             which itself calls @template.lievit.stat-card (a lievit-ui primitive)
   * @spec.when  the template is rendered with a StatWidget(heading="Active listings", value="142")
   * @spec.then  the output contains the stat-card data-slot AND the heading AND the value,
   *             proving: (1) kit/widget/stat.jte resolved from the lievit-kit jar,
   *             (2) lievit/stat-card.jte resolved from the lievit-ui jar via @template.lievit.*,
   *             (3) kit->lievit template composition works end-to-end from imported jars
   *             (RFC 0036 full-chain proof — the last lievit-side prerequisite for the gest cutover)
   */
  @Test
  void kit_stat_widget_renders_via_lievit_primitive_from_imported_jars() {
    // createPrecompiled loads .class files from the test classpath — includes precompiled classes
    // from the lievit-ui jar (lievit/*.jte -> .class), the lievit-kit jar (kit/*.jte -> .class
    // staged and precompiled via this module's build), and poc-kit's own poc-kit.jte class.
    TemplateEngine engine = TemplateEngine.createPrecompiled(ContentType.Html);

    StatWidget stat = StatWidget.create("Active listings", "142");

    StringOutput out = new StringOutput();
    engine.render("poc-kit.jte", Map.of("stat", stat), out);
    String html = out.toString();

    // The stat-card partial (lievit-ui) renders a <figure data-slot="stat-card" ...> root.
    assertTrue(html.contains("data-slot=\"stat-card\""),
        "Expected data-slot=\"stat-card\" from @template.lievit.stat-card in rendered output but got:\n" + html);
    // The heading ("Active listings") must appear in the output.
    assertTrue(html.contains("Active listings"),
        "Expected stat heading 'Active listings' in rendered output but got:\n" + html);
    // The value ("142") must appear in the output.
    assertTrue(html.contains("142"),
        "Expected stat value '142' in rendered output but got:\n" + html);
    // The poc-kit page wrapper must appear.
    assertTrue(html.contains("data-slot=\"poc-kit-page\""),
        "Expected data-slot=\"poc-kit-page\" from poc-kit.jte wrapper but got:\n" + html);
  }
}

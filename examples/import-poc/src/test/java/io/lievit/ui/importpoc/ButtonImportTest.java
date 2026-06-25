/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RFC 0036 import-path proof: renders poc.jte (a consumer template that calls
 * @template.lievit.button) via the precompiled TemplateEngine and asserts the button markup.
 * The lievit/ templates arrived via unpack from the lievit-ui jar — no filesystem copy-in.
 */
package io.lievit.ui.importpoc;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ButtonImportTest {

  /**
   * @spec.given a precompiled TemplateEngine loaded from the classpath (lievit-ui jar + poc's
   *             own precompiled classes), and a poc.jte template that calls @template.lievit.button
   * @spec.when  the template is rendered with label="Hello lievit"
   * @spec.then  the output contains data-slot="button" and the label text, proving
   *             @template.lievit.button resolved from the IMPORTED jar (not a filesystem sibling)
   *             and compiled + rendered correctly end-to-end (RFC 0036 import path proven)
   */
  @Test
  void lievit_button_renders_from_imported_jar() {
    // createPrecompiled loads .class files from the test classpath — includes both the
    // lievit-ui jar's precompiled templates AND poc's own precompiled poc.jte class.
    TemplateEngine engine = TemplateEngine.createPrecompiled(ContentType.Html);

    StringOutput out = new StringOutput();
    engine.render("poc.jte", Map.of("label", "Hello lievit"), out);
    String html = out.toString();

    // The button partial renders a <button data-slot="button" ...> element.
    assertTrue(html.contains("data-slot=\"button\""),
        "Expected data-slot=\"button\" in rendered output but got:\n" + html);
    // The label text must appear in the output.
    assertTrue(html.contains("Hello lievit"),
        "Expected label 'Hello lievit' in rendered output but got:\n" + html);
  }
}

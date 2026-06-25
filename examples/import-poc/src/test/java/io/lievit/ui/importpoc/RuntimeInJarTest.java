/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RFC 0036 stage 3: proves the client runtime TS source is present in the lievit-ui jar
 * at the expected classpath path (lievit-runtime/runtime/features/index.ts).
 *
 * The runtime resource is staged by lievit-ui/pom.xml (add-lievit-runtime-ts execution,
 * targetPath=lievit-runtime/runtime). This test verifies the full delivery chain:
 * lievit-ui jar -> classpath resource -> consumer can locate it.
 *
 * A consumer with a JS bundler (Vite 8) would unpack the jar and import from this path;
 * the jar layout preserves the relative imports (enhancer ../../runtime/runtime.js resolves
 * because the registry/ subtree is at lievit-runtime/registry/ and runtime/ at
 * lievit-runtime/runtime/).
 */
package io.lievit.ui.importpoc;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class RuntimeInJarTest {

  /**
   * @spec.given the lievit-ui jar on the test classpath (resolved as a compile dependency)
   * @spec.when  the runtime entry-point resource is looked up by its jar path
   * @spec.then  the resource is found and contains the installAllFeatures export,
   *             proving the TS source landed in the jar at the expected path (RFC 0036 deliverable 1)
   */
  @Test
  void runtime_entry_point_is_present_in_jar() throws Exception {
    // The resource path in the jar is lievit-runtime/runtime/features/index.ts
    // (set by lievit-ui/pom.xml add-lievit-runtime-ts: targetPath=lievit-runtime/runtime,
    //  source dir=runtime/, so runtime/features/index.ts -> lievit-runtime/runtime/features/index.ts).
    String resourcePath = "lievit-runtime/runtime/features/index.ts";
    InputStream stream = getClass().getClassLoader().getResourceAsStream(resourcePath);

    assertNotNull(stream,
        "Expected classpath resource '" + resourcePath + "' from lievit-ui jar to be present. "
            + "Check lievit-ui/pom.xml add-lievit-runtime-ts execution and lievit-ui build.");

    String content = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    // The runtime features index exports installAllFeatures — verify the content is correct.
    assertTrue(content.contains("installAllFeatures"),
        "Expected 'installAllFeatures' export in " + resourcePath + " but got:\n" + content);
  }

  /**
   * @spec.given the lievit-ui jar on the test classpath
   * @spec.when  a colocated enhancer TS file is looked up by its jar path
   * @spec.then  the resource is found at lievit-runtime/registry/jte/chart.enhancer.ts,
   *             proving the registry subtree is present (RFC 0036 deliverable 1: registry layout)
   */
  @Test
  void colocated_enhancer_is_present_in_jar() throws Exception {
    String resourcePath = "lievit-runtime/registry/jte/chart.enhancer.ts";
    InputStream stream = getClass().getClassLoader().getResourceAsStream(resourcePath);

    assertNotNull(stream,
        "Expected classpath resource '" + resourcePath + "' from lievit-ui jar to be present. "
            + "Check lievit-ui/pom.xml add-lievit-runtime-registry execution.");
    // Just confirm it's not empty — content correctness is the lievit-ui source's responsibility.
    assertTrue(stream.readAllBytes().length > 0,
        "Expected non-empty content for " + resourcePath);
  }

  /**
   * @spec.given the lievit-ui jar on the test classpath
   * @spec.when  the design tokens CSS is looked up by its jar path
   * @spec.then  the resource is found at lievit-runtime/registry/tokens/lievit-tokens.css
   */
  @Test
  void tokens_css_is_present_in_jar() throws Exception {
    String resourcePath = "lievit-runtime/registry/tokens/lievit-tokens.css";
    InputStream stream = getClass().getClassLoader().getResourceAsStream(resourcePath);

    assertNotNull(stream,
        "Expected classpath resource '" + resourcePath + "' from lievit-ui jar to be present. "
            + "Check lievit-ui/pom.xml add-lievit-runtime-registry execution.");
    assertTrue(stream.readAllBytes().length > 0,
        "Expected non-empty content for " + resourcePath);
  }
}

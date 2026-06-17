/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.dsl;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;
import org.junit.jupiter.api.Test;

/**
 * The module-boundary invariants for {@code lievit-dsl} (ADR-0004/0006/0007): it depends only on the
 * core (and the JDK / JSpecify), never on Spring, never on another adapter, and uses no runtime
 * reflection beyond the single {@code @LievitRender} invoke the core already performs. These keep the
 * module graph acyclic and the GraalVM-native tree-shaking clean.
 */
class DslBoundaryInvariantTest {

    private static final JavaClasses MAIN =
            new ClassFileImporter()
                    .withImportOption(new ImportOption.DoNotIncludeTests())
                    .importPackages("com.iambilotta.lievit.dsl");

    /**
     * @spec.given the lievit-dsl main classes
     * @spec.when  their dependencies are inspected
     * @spec.then  none depend on Spring: the DSL is pure Java, the web layer lives in the starter
     * @spec.adr   ADR-0007
     */
    @Test
    void the_dsl_does_not_depend_on_spring() {
        ArchRule rule =
                ArchRuleDefinition.noClasses()
                        .that()
                        .resideInAPackage("com.iambilotta.lievit.dsl..")
                        .should()
                        .dependOnClassesThat()
                        .resideInAnyPackage("org.springframework..");
        rule.check(MAIN);
    }

    /**
     * @spec.given the lievit-dsl main classes
     * @spec.when  their dependencies are inspected
     * @spec.then  none depend on another adapter module (jte/thymeleaf/mustache/freemarker/raw)
     * @spec.adr   ADR-0004
     */
    @Test
    void the_dsl_does_not_depend_on_another_adapter() {
        ArchRule rule =
                ArchRuleDefinition.noClasses()
                        .that()
                        .resideInAPackage("com.iambilotta.lievit.dsl..")
                        .should()
                        .dependOnClassesThat()
                        .resideInAnyPackage(
                                "com.iambilotta.lievit.jte..",
                                "com.iambilotta.lievit.thymeleaf..",
                                "com.iambilotta.lievit.mustache..",
                                "com.iambilotta.lievit.freemarker..",
                                "com.iambilotta.lievit.raw..");
        rule.check(MAIN);
    }
}

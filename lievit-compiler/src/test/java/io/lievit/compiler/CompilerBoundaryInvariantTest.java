/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;
import org.junit.jupiter.api.Test;

/**
 * The module-boundary invariants for {@code lievit-compiler} (ADR-0023, ADR-0004/0006/0007): the
 * authoring/compile layer depends only on the core (and the JDK / JSpecify), never on Spring, never
 * on a template-engine adapter, and never on the DSL module. It produces inputs the dispatcher
 * consumes; it never reaches into the web/dispatch layer. These keep the module graph acyclic and
 * the GraalVM-native tree-shaking clean.
 */
class CompilerBoundaryInvariantTest {

    private static final JavaClasses MAIN =
            new ClassFileImporter()
                    .withImportOption(new ImportOption.DoNotIncludeTests())
                    .importPackages("io.lievit.compiler");

    /**
     * @spec.given the lievit-compiler main classes
     * @spec.when  their dependencies are inspected
     * @spec.then  none depend on Spring: the compiler is pure Java, the wiring lives in the starter
     * @spec.adr   ADR-0023
     */
    @Test
    void the_compiler_does_not_depend_on_spring() {
        ArchRule rule =
                ArchRuleDefinition.noClasses()
                        .that()
                        .resideInAPackage("io.lievit.compiler..")
                        .should()
                        .dependOnClassesThat()
                        .resideInAnyPackage("org.springframework..");
        rule.check(MAIN);
    }

    /**
     * @spec.given the lievit-compiler main classes
     * @spec.when  their dependencies are inspected
     * @spec.then  none depend on a template-engine adapter or the DSL module (no adapter coupling)
     * @spec.adr   ADR-0004
     */
    @Test
    void the_compiler_does_not_depend_on_an_adapter_or_the_dsl() {
        ArchRule rule =
                ArchRuleDefinition.noClasses()
                        .that()
                        .resideInAPackage("io.lievit.compiler..")
                        .should()
                        .dependOnClassesThat()
                        .resideInAnyPackage(
                                "io.lievit.dsl..",
                                "io.lievit.jte..",
                                "io.lievit.thymeleaf..",
                                "io.lievit.mustache..",
                                "io.lievit.freemarker..",
                                "io.lievit.raw..");
        rule.check(MAIN);
    }
}

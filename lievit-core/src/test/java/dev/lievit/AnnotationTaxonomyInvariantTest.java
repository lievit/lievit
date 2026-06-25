/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.lang.annotation.Annotation;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;

/**
 * Pins the documented public-annotation taxonomy to the code, so the package-info role taxonomy can
 * never silently drift from the actual set of runtime {@code @interface} types (the drift that taught
 * a false "seven / eight / nine annotations" invariant for years).
 *
 * <p>ACTUAL set: every top-level, runtime-retained annotation type directly in the {@code dev.lievit}
 * package (not subpackages, not nested container annotations like {@code @LievitAuthorize.List}).
 * DOCUMENTED set: the {@code {@link dev.lievit.X}} references in {@code package-info.java}. The two
 * must be exactly equal: add a public annotation and you must document it; document one and it must
 * exist.
 */
class AnnotationTaxonomyInvariantTest {

    private static final String TOP_LEVEL_PACKAGE = "dev.lievit";

    /**
     * @spec.given the package-info role taxonomy and the runtime @interface types in dev.lievit
     * @spec.when  the documented annotation set is compared to the actual reflected set
     * @spec.then  they are exactly equal (no undocumented annotation, no documented-but-missing one)
     * @spec.adr   ADR-0002
     */
    @Test
    void the_documented_taxonomy_matches_the_actual_runtime_annotation_types() throws IOException {
        Set<String> actual = actualRuntimeAnnotationTypes();
        Set<String> documented = documentedAnnotationTypes();

        assertThat(documented)
                .as("package-info documents every runtime @interface in dev.lievit, and no phantom")
                .isEqualTo(actual);
    }

    /** The simple names of every top-level runtime-retained annotation directly in dev.lievit. */
    private static Set<String> actualRuntimeAnnotationTypes() {
        JavaClasses classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages(TOP_LEVEL_PACKAGE);
        Set<String> names = new TreeSet<>();
        for (JavaClass clazz : classes) {
            if (!clazz.getPackageName().equals(TOP_LEVEL_PACKAGE)) {
                continue; // subpackages (component, render, wire, ...) are not the public surface
            }
            if (!clazz.isAnnotation() || clazz.isNestedClass()) {
                continue; // skip non-annotations and nested containers (@LievitAuthorize.List)
            }
            Class<?> reflected = clazz.reflect();
            if (isRuntimeRetained(reflected)) {
                names.add(reflected.getSimpleName());
            }
        }
        return names;
    }

    private static boolean isRuntimeRetained(Class<?> annotationType) {
        Retention retention = annotationType.getAnnotation(Retention.class);
        return retention != null && retention.value() == RetentionPolicy.RUNTIME;
    }

    /** The simple names of every {@code {@link dev.lievit.X}} reference in package-info.java. */
    private static Set<String> documentedAnnotationTypes() throws IOException {
        Path packageInfo = Path.of("src/main/java/dev/lievit/package-info.java");
        assertThat(packageInfo)
                .as("package-info.java is read relative to the lievit-core module root")
                .exists();
        String source = Files.readString(packageInfo, StandardCharsets.UTF_8);

        Set<String> documented = new LinkedHashSet<>();
        Matcher m = Pattern.compile("\\{@link dev\\.lievit\\.(\\w+)\\}").matcher(source);
        while (m.find()) {
            documented.add(m.group(1));
        }
        return new TreeSet<>(documented);
    }
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

/**
 * Pins {@link DirectiveNames#BUILTIN} against the client runtime's directive registry under
 * {@code lievit-ui/runtime/}: the Java list is a hand-mirrored copy of the TypeScript registry (the
 * two cannot share a literal), so this test scans the runtime sources for every {@code l:<name>}
 * lievit registers and asserts the Java set matches. A new client directive that forgets to update
 * the Java list (or a stale Java entry) fails the build, killing the drift risk inherent in a
 * mirrored list.
 *
 * <p>The scan is a deliberately broad regex over the TypeScript source text (directive {@code name:}
 * literals, {@code getAttribute("l:..")} reads, {@code "l:.."} startsWith checks). It is not a TS
 * parser; it errs toward over-collecting, which is the safe direction (a missed mirror still fails).
 * When the runtime tree is not present (an isolated module build that does not check out the UI
 * sources), the test is skipped rather than failed.
 */
class DirectiveNamesParityTest {

    /** A directive name found in the TS runtime: a `name: "x"` literal or a `const NAME = "x"`. */
    private static final Pattern NAME_LITERAL =
            Pattern.compile("(?:\\bname:\\s*|\\bconst NAME\\s*=\\s*)\"([a-z][a-z0-9-]*)\"");

    /**
     * An {@code l:<name>} attribute literal as read/checked in the runtime: a quoted/backticked
     * string, a {@code style[l\\:scope]} CSS selector, or a {@code `<style l:scope>`} doc form. The
     * leading class covers quote, backtick, {@code [}, {@code <}, and whitespace; the {@code l\\?:}
     * accepts the CSS-escaped {@code l\:} form too.
     */
    private static final Pattern L_ATTR =
            Pattern.compile("[\"'`\\[<\\s]l\\\\?:([a-z][a-z0-9-]*)(?:[.\\s\"'`\\]\\\\>=]|$)");

    /**
     * Names that appear in the runtime as {@code l:<name>} but are NOT directives in the
     * registry-checked sense (so they must not be required to live in the Java set): tag-internal
     * markers, doc references to data-attributes, etc. Kept tiny and explicit; empty today.
     */
    private static final Set<String> RUNTIME_NON_DIRECTIVES = Set.of();

    /**
     * Java-side valid {@code l:} attribute names handled by the {@code LievitTagCompiler} (mount-tag
     * attributes), not by the client runtime registry, so they are legitimately absent from the TS
     * scan. {@code l:key} is the explicit-key namespace on a {@code <lievit:...>} mount tag.
     */
    private static final Set<String> TAG_COMPILER_ONLY = Set.of("key");

    /**
     * @spec.given the TypeScript runtime sources under lievit-ui/runtime
     * @spec.when  every l:&lt;name&gt; the runtime registers is collected
     * @spec.then  the Java DirectiveNames.BUILTIN set contains exactly those names (no drift)
     */
    @Test
    void java_directive_set_mirrors_the_client_runtime_registry() {
        Path runtime = locateRuntimeDir();
        assumeTrue(runtime != null, "lievit-ui/runtime not found from the test working dir; skipping parity");

        Set<String> fromRuntime = scanRuntimeDirectiveNames(runtime);
        assumeTrue(!fromRuntime.isEmpty(), "no l: directives parsed from runtime sources; skipping parity");

        // Every runtime-registered directive must be mirrored in Java (else a template using it
        // would be wrongly rejected at startup).
        Set<String> missingInJava = new TreeSet<>(fromRuntime);
        missingInJava.removeAll(DirectiveNames.BUILTIN);
        missingInJava.removeAll(RUNTIME_NON_DIRECTIVES);
        assertThat(missingInJava)
                .as("directives registered by the runtime but missing from DirectiveNames.BUILTIN")
                .isEmpty();

        // Every Java entry must still exist in the runtime (else it is a stale mirror that would let
        // a now-removed directive pass validation), except the tag-compiler-only attrs that the
        // client runtime legitimately does not register.
        Set<String> staleInJava = new TreeSet<>(DirectiveNames.BUILTIN);
        staleInJava.removeAll(fromRuntime);
        staleInJava.removeAll(TAG_COMPILER_ONLY);
        assertThat(staleInJava)
                .as("directives in DirectiveNames.BUILTIN that the runtime no longer registers")
                .isEmpty();
    }

    /** Walks the runtime tree and collects every directive name from the two patterns. */
    private static Set<String> scanRuntimeDirectiveNames(Path runtime) {
        Set<String> names = new TreeSet<>();
        try (Stream<Path> files = Files.walk(runtime)) {
            files.filter(p -> p.toString().endsWith(".ts"))
                    .forEach(p -> collectFrom(read(p), names));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return names;
    }

    private static void collectFrom(String src, Set<String> into) {
        Matcher nameMatcher = NAME_LITERAL.matcher(src);
        while (nameMatcher.find()) {
            into.add(nameMatcher.group(1));
        }
        Matcher attrMatcher = L_ATTR.matcher(src);
        while (attrMatcher.find()) {
            into.add(attrMatcher.group(1));
        }
    }

    private static String read(Path p) {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * Finds {@code lievit-ui/runtime} by walking up from the test working directory (the compiler
     * module dir under Maven) toward the repo root. Returns {@code null} when not found.
     */
    private static Path locateRuntimeDir() {
        Path dir = Path.of("").toAbsolutePath();
        for (int i = 0; i < 6 && dir != null; i++) {
            Path candidate = dir.resolve("lievit-ui").resolve("runtime");
            if (Files.isDirectory(candidate)) {
                return candidate;
            }
            dir = dir.getParent();
        }
        return null;
    }
}

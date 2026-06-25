/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Spec for the Vite build-manifest lookup (issue #171, ADR-0060): a parsed {@code .vite/manifest.json}
 * resolves a logical entry name to its content-hashed built file (the version map that lets the
 * runtime bundle be served with a long cache TTL and busted only when its bytes change). Pure data,
 * no Spring, no IO.
 */
class AssetManifestTest {

    /**
     * @spec.given a parsed Vite manifest mapping the runtime entry to a hashed file with split CSS
     * @spec.when  the runtime entry is resolved
     * @spec.then  the hashed file and its CSS files are returned (the versioned serve target)
     * @spec.adr   ADR-0060
     * @spec.us    US-171-asset-pipeline
     */
    @Test
    void resolves_a_logical_entry_to_its_hashed_file_and_css() {
        AssetManifest manifest =
                AssetManifest.of(
                        Map.of(
                                "runtime/index.ts",
                                Map.of(
                                        "file", "assets/index-B7PI925R.js",
                                        "isEntry", true,
                                        "css", List.of("assets/index-ChJ_j.css"))));

        AssetManifest.Entry entry = manifest.resolve("runtime/index.ts").orElseThrow();

        assertThat(entry.file()).isEqualTo("assets/index-B7PI925R.js");
        assertThat(entry.css()).containsExactly("assets/index-ChJ_j.css");
    }

    /**
     * @spec.given a manifest with no entry for a requested module
     * @spec.when  that module is resolved
     * @spec.then  the lookup is empty so the caller can fall back to the unhashed dev path
     * @spec.adr   ADR-0060
     */
    @Test
    void misses_an_unknown_entry_so_the_caller_falls_back() {
        AssetManifest manifest =
                AssetManifest.of(Map.of("runtime/index.ts", Map.of("file", "assets/index-abc.js")));

        assertThat(manifest.resolve("Foo.lievit.ts")).isEmpty();
        assertThat(manifest.resolve(null)).isEmpty();
    }

    /**
     * @spec.given a null or empty raw manifest (dev mode, or a build that emitted none)
     * @spec.when  the manifest is built
     * @spec.then  it is the empty manifest, every lookup misses
     * @spec.adr   ADR-0060
     */
    @Test
    void an_absent_manifest_is_the_empty_manifest() {
        assertThat(AssetManifest.of(null).isEmpty()).isTrue();
        assertThat(AssetManifest.of(Map.of()).isEmpty()).isTrue();
        assertThat(AssetManifest.of(Map.of()).resolve("anything")).isEmpty();
    }

    /**
     * @spec.given a manifest with a malformed entry (missing the required {@code file})
     * @spec.when  the manifest is built
     * @spec.then  the malformed entry is skipped rather than throwing, so one bad record cannot break
     *     serving every asset
     * @spec.adr   ADR-0060
     */
    @Test
    void skips_a_malformed_entry_without_throwing() {
        AssetManifest manifest =
                AssetManifest.of(
                        Map.of(
                                "good.ts", Map.of("file", "assets/good-1.js"),
                                "bad.ts", Map.of("name", "bad"),
                                "notamap.ts", "x"));

        assertThat(manifest.resolve("good.ts")).isPresent();
        assertThat(manifest.resolve("bad.ts")).isEmpty();
        assertThat(manifest.resolve("notamap.ts")).isEmpty();
    }
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Specifies the {@link TemporaryUploadedFile} value (issue #189): the {@code @Wire} property value an
 * upload produces. It carries only a signed reference (the temp token + metadata), never the bytes,
 * so it round-trips across the stateless wire as a reference via the {@link io.lievit.wire.synth.Wireable}
 * synth path (state-never-code, wire-protocol.md §2). Validation reuses {@link UploadConstraints};
 * {@code store(...)} moves the temp file to permanent storage through a {@link FileStore} SPI.
 */
class TemporaryUploadedFileTest {

    private final SynthesizerRegistry registry = new SynthesizerRegistry();

    /**
     * @spec.given a temporary uploaded file holding a signed token + name + size + mime
     * @spec.when  it is dehydrated to the snapshot and hydrated back through the registry
     * @spec.then  the reconstructed value equals the original: the reference survives, not the bytes
     */
    @Test
    void round_trips_as_a_reference_through_the_synth_registry() {
        TemporaryUploadedFile file =
                new TemporaryUploadedFile("2026/06/abc.png.tok", "photo.png", 2048, "image/png");

        Object dehydrated = registry.dehydrate(file);
        Object hydrated = registry.hydrate(dehydrated);

        assertThat(hydrated).isInstanceOf(TemporaryUploadedFile.class);
        assertThat(hydrated).isEqualTo(file);
    }

    /**
     * @spec.given a dehydrated temporary uploaded file
     * @spec.when  the dehydrated payload is inspected
     * @spec.then  it is a typed tuple carrying the token, never the file bytes (state-never-code)
     */
    @Test
    void dehydrates_to_a_reference_tuple_without_bytes() {
        TemporaryUploadedFile file =
                new TemporaryUploadedFile("2026/06/abc.png.tok", "photo.png", 2048, "image/png");

        Object dehydrated = registry.dehydrate(file);

        assertThat(dehydrated.toString()).contains("2026/06/abc.png.tok");
        assertThat(dehydrated.toString()).doesNotContain("bytes");
    }

    /**
     * @spec.given a temporary file whose name and size satisfy the constraints
     * @spec.when  it is validated against those constraints
     * @spec.then  no violations are reported
     */
    @Test
    void validates_clean_against_satisfied_constraints() {
        TemporaryUploadedFile file =
                new TemporaryUploadedFile("t.png.tok", "photo.png", 1024, "image/png");
        UploadConstraints constraints = new UploadConstraints(4096, Set.of("png", "jpg"));

        assertThat(file.validate(constraints)).isEmpty();
    }

    /**
     * @spec.given a temporary file over the size cap and of a disallowed extension
     * @spec.when  it is validated against the constraints
     * @spec.then  both the size and the extension violations are reported
     */
    @Test
    void reports_violations_for_an_oversize_disallowed_file() {
        TemporaryUploadedFile file =
                new TemporaryUploadedFile("t.exe.tok", "virus.exe", 99999, "application/octet-stream");
        UploadConstraints constraints = new UploadConstraints(4096, Set.of("png"));

        List<String> violations = file.validate(constraints);

        assertThat(violations).hasSize(2);
    }

    /**
     * @spec.given a temporary file and a recording file store
     * @spec.when  store(store, "avatars") is called
     * @spec.then  the store moves the temp reference to the named destination and returns the stored
     *             relative path (the permanent location)
     */
    @Test
    void store_moves_the_temp_file_to_permanent_storage_via_the_spi() {
        TemporaryUploadedFile file =
                new TemporaryUploadedFile("2026/06/abc.png.tok", "photo.png", 2048, "image/png");
        RecordingFileStore store = new RecordingFileStore();

        String stored = file.store(store, "avatars");

        assertThat(store.movedFrom).isEqualTo(file);
        assertThat(store.movedTo).isEqualTo("avatars");
        assertThat(stored).isEqualTo("avatars/photo.png");
    }

    /**
     * @spec.given a temporary file
     * @spec.when  store is called with a blank destination
     * @spec.then  it throws (a destination directory is required)
     */
    @Test
    void store_requires_a_non_blank_destination() {
        TemporaryUploadedFile file = new TemporaryUploadedFile("t.tok", "a.png", 1, "image/png");
        assertThatThrownBy(() -> file.store(new RecordingFileStore(), "  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * @spec.given the {@code fromWire} factory of the value
     * @spec.when  it is rebuilt from the same map {@code toWire} produced
     * @spec.then  the value reconstructs exactly (the Wireable contract holds)
     */
    @Test
    void from_wire_rebuilds_from_to_wire_data() {
        TemporaryUploadedFile file = new TemporaryUploadedFile("t.tok", "a.png", 7, "image/png");
        Object wire = file.toWire();
        assertThat(wire).isInstanceOf(Map.class);
        assertThat(TemporaryUploadedFile.fromWire(wire)).isEqualTo(file);
    }

    /** A {@link FileStore} that records its single move, for asserting the SPI is driven correctly. */
    private static final class RecordingFileStore implements FileStore {
        private TemporaryUploadedFile movedFrom;
        private String movedTo;

        @Override
        public String store(TemporaryUploadedFile file, String destinationDirectory) {
            this.movedFrom = file;
            this.movedTo = destinationDirectory;
            return destinationDirectory + "/" + file.clientName();
        }
    }
}

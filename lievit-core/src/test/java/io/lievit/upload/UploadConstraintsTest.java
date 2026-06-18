/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.upload;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;

/**
 * Specifies upload validation (issue #159): a too-large file and a disallowed extension produce
 * violations; an acceptable file produces none; extension matching is by the file NAME (not the
 * spoofable client mime) and case-insensitive.
 */
class UploadConstraintsTest {

    /**
     * @spec.given a constraint with a small size cap
     * @spec.when  a file larger than the cap is validated
     * @spec.then  a size violation is reported
     */
    @Test
    void flags_a_file_over_the_size_cap() {
        UploadConstraints constraints = new UploadConstraints(10, Set.of());
        assertThat(constraints.validate("a.png", 20)).isNotEmpty();
    }

    /**
     * @spec.given a constraint allowing only png by extension
     * @spec.when  a file with a disallowed extension is validated
     * @spec.then  an extension violation is reported
     */
    @Test
    void flags_a_disallowed_extension() {
        UploadConstraints constraints = new UploadConstraints(1000, Set.of("png"));
        assertThat(constraints.validate("evil.exe", 10)).isNotEmpty();
    }

    /**
     * @spec.given a constraint allowing png, validated case-insensitively
     * @spec.when  a file within size and with an allowed (upper-case) extension is validated
     * @spec.then  no violations are reported
     */
    @Test
    void accepts_an_allowed_file_case_insensitively() {
        UploadConstraints constraints = new UploadConstraints(1000, Set.of("png"));
        assertThat(constraints.validate("photo.PNG", 10)).isEmpty();
    }
}

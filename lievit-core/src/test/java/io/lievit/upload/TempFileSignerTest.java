/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

/**
 * Specifies the upload temp-path signer (issue #159): a relative path round-trips through sign /
 * verify, a forged or tampered token is rejected, an expired token fails, and a traversal path is
 * refused at both sign and verify. The signature, not obscurity, is the boundary (state-never-code).
 */
class TempFileSignerTest {

    private final byte[] key = "an-upload-signing-key-at-least-32-bytes!".getBytes(StandardCharsets.UTF_8);
    private final TempFileSigner signer = new TempFileSigner(key, Duration.ofMinutes(30));
    private final Instant now = Instant.parse("2026-06-18T12:00:00Z");

    /**
     * @spec.given a safe relative temp path and a signer
     * @spec.when  the path is signed and the resulting token is verified
     * @spec.then  the verified path equals the original (round-trip)
     */
    @Test
    void round_trips_a_safe_relative_path() {
        SignedTempPath signed = signer.sign("2026/06/abc123.png", now);
        assertThat(signer.verify(signed.token(), now)).isEqualTo("2026/06/abc123.png");
    }

    /**
     * @spec.given a token whose signature bytes have been altered
     * @spec.when  the tampered token is verified
     * @spec.then  verification throws (the HMAC catches the forgery)
     */
    @Test
    void rejects_a_tampered_signature() {
        SignedTempPath signed = signer.sign("a.png", now);
        String tampered = signed.token().substring(0, signed.token().length() - 2) + "XY";
        assertThatThrownBy(() -> signer.verify(tampered, now)).isInstanceOf(InvalidTempPathException.class);
    }

    /**
     * @spec.given a validly signed token and a clock past its expiry
     * @spec.when  the token is verified after the TTL elapsed
     * @spec.then  verification throws as expired (the preview window closed)
     */
    @Test
    void rejects_an_expired_token() {
        SignedTempPath signed = signer.sign("a.png", now);
        Instant later = now.plus(Duration.ofMinutes(31));
        assertThatThrownBy(() -> signer.verify(signed.token(), later))
                .isInstanceOf(InvalidTempPathException.class);
    }

    /**
     * @spec.given a path-traversal path
     * @spec.when  the signer is asked to sign it
     * @spec.then  signing is refused (the path can never escape the temp root)
     */
    @Test
    void refuses_to_sign_a_traversal_path() {
        assertThatThrownBy(() -> signer.sign("../../etc/passwd", now))
                .isInstanceOf(InvalidTempPathException.class);
    }

    /**
     * @spec.given a token forged for a traversal path with a guessed signature
     * @spec.when  it is verified
     * @spec.then  verification throws before any path is returned (defense in depth)
     */
    @Test
    void refuses_a_forged_traversal_token() {
        assertThatThrownBy(() -> signer.verify("Li4vLi4=.99999999999.AAAA", now))
                .isInstanceOf(InvalidTempPathException.class);
    }
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

import java.time.Duration;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration for the lievit runtime, bound from {@code lievit.*} (ADR-0001, wire-protocol.md
 * §3/§6).
 *
 * <p>The signing key is the security floor: {@code lievit.signing-key} must be at least 32 bytes
 * (base64url), or startup fails. {@code lievit.signing-key-prev} is the previous key during a
 * 24 h rotation grace window. The TTL is the snapshot idle lifetime.
 */
@ConfigurationProperties(prefix = "lievit")
public class LievitProperties {

    /** The current HS256 signing key (base64url, &gt;= 32 bytes). Required. */
    private @Nullable String signingKey;

    /** Key id for the current signing key (rides in the JWT header for rotation). */
    private String signingKid = "k1";

    /** The previous signing key, accepted during the rotation grace window. Optional. */
    private @Nullable String signingKeyPrev;

    /** Key id for the previous signing key. */
    private @Nullable String signingKidPrev;

    /** The snapshot idle time-to-live (default 1 h, wire-protocol §6). */
    private Duration ttl = Duration.ofHours(1);

    public @Nullable String getSigningKey() {
        return signingKey;
    }

    public void setSigningKey(@Nullable String signingKey) {
        this.signingKey = signingKey;
    }

    public String getSigningKid() {
        return signingKid;
    }

    public void setSigningKid(String signingKid) {
        this.signingKid = signingKid;
    }

    public @Nullable String getSigningKeyPrev() {
        return signingKeyPrev;
    }

    public void setSigningKeyPrev(@Nullable String signingKeyPrev) {
        this.signingKeyPrev = signingKeyPrev;
    }

    public @Nullable String getSigningKidPrev() {
        return signingKidPrev;
    }

    public void setSigningKidPrev(@Nullable String signingKidPrev) {
        this.signingKidPrev = signingKidPrev;
    }

    public Duration getTtl() {
        return ttl;
    }

    public void setTtl(Duration ttl) {
        this.ttl = ttl;
    }
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

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

    /** Max {@code _updates} entries per wire call (DoS cap, ADR-0013). */
    private int maxUpdates = 100;

    /** Max {@code _calls} entries per wire call (Livewire parity 50, ADR-0013). */
    private int maxCalls = 50;

    /** Max update-value nesting depth (Livewire parity 10, ADR-0013). */
    private int maxNestingDepth = 10;

    /** File-upload temp root directory (issue #159). Default: {@code ${java.io.tmpdir}/lievit-uploads}. */
    private @Nullable String uploadTempDir;

    /** File-upload max size in bytes (issue #159). Default 12 MiB. */
    private long uploadMaxBytes = io.lievit.upload.UploadConstraints.DEFAULT_MAX_BYTES;

    /** Upload preview signed-token TTL (issue #159, the 30-min preview window). */
    private Duration uploadPreviewTtl = Duration.ofMinutes(30);

    /**
     * Permanent root the default local {@code FileStore} moves stored uploads under (issue #189).
     * Default: {@code ${java.io.tmpdir}/lievit-files}. An adopter using object storage replaces the
     * {@code FileStore} bean and ignores this.
     */
    private @Nullable String uploadStoreDir;

    /**
     * Max age a temp upload may reach before the cleanup reaper deletes it (issue #191). Default 24h;
     * an orphaned temp file (uploaded but never stored) expires after this.
     */
    private Duration uploadCleanupMaxAge = Duration.ofHours(24);

    /**
     * How often the temp-upload cleanup reaper runs (issue #191). Default 1h. Set to {@code 0} (or a
     * non-positive duration) to disable the scheduled reaper entirely.
     */
    private Duration uploadCleanupInterval = Duration.ofHours(1);

    /** Broadcast (live server→client push over SSE) settings (issue #304). Opt-in, disabled by default. */
    private final Broadcast broadcast = new Broadcast();

    /** Auto-injection of the runtime assets on full-page responses (issue #121). */
    private final Assets assets = new Assets();

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

    public int getMaxUpdates() {
        return maxUpdates;
    }

    public void setMaxUpdates(int maxUpdates) {
        this.maxUpdates = maxUpdates;
    }

    public int getMaxCalls() {
        return maxCalls;
    }

    public void setMaxCalls(int maxCalls) {
        this.maxCalls = maxCalls;
    }

    public int getMaxNestingDepth() {
        return maxNestingDepth;
    }

    public void setMaxNestingDepth(int maxNestingDepth) {
        this.maxNestingDepth = maxNestingDepth;
    }

    public @Nullable String getUploadTempDir() {
        return uploadTempDir;
    }

    public void setUploadTempDir(@Nullable String uploadTempDir) {
        this.uploadTempDir = uploadTempDir;
    }

    public long getUploadMaxBytes() {
        return uploadMaxBytes;
    }

    public void setUploadMaxBytes(long uploadMaxBytes) {
        this.uploadMaxBytes = uploadMaxBytes;
    }

    public Duration getUploadPreviewTtl() {
        return uploadPreviewTtl;
    }

    public void setUploadPreviewTtl(Duration uploadPreviewTtl) {
        this.uploadPreviewTtl = uploadPreviewTtl;
    }

    public @Nullable String getUploadStoreDir() {
        return uploadStoreDir;
    }

    public void setUploadStoreDir(@Nullable String uploadStoreDir) {
        this.uploadStoreDir = uploadStoreDir;
    }

    public Duration getUploadCleanupMaxAge() {
        return uploadCleanupMaxAge;
    }

    public void setUploadCleanupMaxAge(Duration uploadCleanupMaxAge) {
        this.uploadCleanupMaxAge = uploadCleanupMaxAge;
    }

    public Duration getUploadCleanupInterval() {
        return uploadCleanupInterval;
    }

    public void setUploadCleanupInterval(Duration uploadCleanupInterval) {
        this.uploadCleanupInterval = uploadCleanupInterval;
    }

    public Broadcast getBroadcast() {
        return broadcast;
    }

    public Assets getAssets() {
        return assets;
    }

    /**
     * Auto-injected-assets configuration, bound from {@code lievit.assets.*} (issue #121, ADR-0037).
     * The runtime {@code <style>}/{@code <script>} are injected into full-page responses produced
     * from a mounted component, so a host app gets the client runtime with no manual tags. Enabled by
     * default ("it just works"); {@code enabled=false} turns it off for an app that wires the runtime
     * itself, and {@code force=true} keeps it on even for a page that already includes a (different)
     * runtime tag. The bundle URLs default to lievit's served paths; the build/version story is the
     * asset-pipeline concern (issue #171).
     */
    public static class Assets {

        /** Whether the runtime assets are auto-injected into full-page responses. Default true. */
        private boolean enabled = true;

        /**
         * Force injection even when the page already references a runtime script. Default false (the
         * injector is otherwise idempotent and skips a page that already carries the runtime).
         */
        private boolean force = false;

        /** The runtime bundle URL injected as the {@code <script src>}. */
        private String scriptUrl = "/lievit/lievit.js";

        /** The runtime stylesheet URL, or empty for the zero-CSS default (ADR-0005): no stylesheet. */
        private String styleUrl = "";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public boolean isForce() {
            return force;
        }

        public void setForce(boolean force) {
            this.force = force;
        }

        public String getScriptUrl() {
            return scriptUrl;
        }

        public void setScriptUrl(String scriptUrl) {
            this.scriptUrl = scriptUrl;
        }

        public String getStyleUrl() {
            return styleUrl;
        }

        public void setStyleUrl(String styleUrl) {
            this.styleUrl = styleUrl;
        }
    }

    /**
     * Broadcast (live push over SSE) configuration, bound from {@code lievit.broadcast.*} (issue
     * #304). Disabled by default: an app that does not push live notifications never opens a channel.
     */
    public static class Broadcast {

        /** Whether the broadcast SSE channel is mounted. Opt-in (default {@code false}). */
        private boolean enabled = false;

        /**
         * The SSE connection idle timeout (default 5 min). The browser {@code EventSource} reconnects
         * after it, so the connection is bounded server-side rather than held forever.
         */
        private Duration timeout = Duration.ofMinutes(5);

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public Duration getTimeout() {
            return timeout;
        }

        public void setTimeout(Duration timeout) {
            this.timeout = timeout;
        }
    }
}

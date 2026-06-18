/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.upload;

import java.util.List;
import java.util.Map;

import io.lievit.wire.synth.Wireable;

/**
 * The {@code @Wire} property value an upload produces (issue #189, the Livewire
 * {@code TemporaryUploadedFile} analogue). It holds a <strong>signed reference</strong> to the
 * uploaded bytes (the temp token the {@code /lievit/upload} endpoint returned) plus the metadata a
 * component needs to validate and render a preview, never the bytes themselves. So when the property
 * round-trips across the stateless wire it survives as a reference, not a 12 MiB base64 payload
 * (state-never-code, wire-protocol.md §2): it implements {@link Wireable}, so the existing
 * {@code WireableSynthesizer} dehydrates / hydrates it with no new synth to register.
 *
 * <p>The flow (Livewire parity):
 *
 * <ol>
 *   <li>the client uploads bytes out-of-band; the endpoint validates + stores them to a temp disk
 *       and hands back a signed token; the client sets the {@code @Wire} field to this value;
 *   <li>the component runs {@link #validate(UploadConstraints)} (image / max / extensions);
 *   <li>{@link #store(FileStore, String)} moves the temp file to permanent storage and returns the
 *       durable relative path.
 * </ol>
 *
 * <p>Pure value, zero Spring (ADR-0007). The {@code token} is opaque here; only the
 * {@link TempFileSigner} (and the {@link FileStore} the adopter wires) ever resolves it to a path.
 *
 * @param token the HMAC-signed temp reference returned by the upload endpoint (path-traversal- and
 *     expiry-checked by {@link TempFileSigner}); the only thing that crosses the wire for the bytes
 * @param clientName the original (client) file name, used for the extension check and the stored name
 * @param sizeBytes the byte size of the uploaded content
 * @param mimeType the client-reported mime type (advisory; the extension is the non-spoofable check)
 */
public record TemporaryUploadedFile(String token, String clientName, long sizeBytes, String mimeType)
        implements Wireable {

    /** The {@code toWire} map key for the signed temp token. */
    public static final String TOKEN_KEY = "path";

    /** The {@code toWire} map key for the original client file name. */
    public static final String NAME_KEY = "name";

    /** The {@code toWire} map key for the byte size. */
    public static final String SIZE_KEY = "size";

    /** The {@code toWire} map key for the mime type. */
    public static final String MIME_KEY = "mime";

    /**
     * @param token the signed temp reference (must be non-blank)
     * @param clientName the original file name (must be non-blank)
     * @param sizeBytes the byte size (must be non-negative)
     * @param mimeType the mime type (must be non-blank)
     */
    public TemporaryUploadedFile {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("a temporary uploaded file needs a signed token");
        }
        if (clientName == null || clientName.isBlank()) {
            throw new IllegalArgumentException("a temporary uploaded file needs a client name");
        }
        if (sizeBytes < 0) {
            throw new IllegalArgumentException("file size must be non-negative");
        }
        if (mimeType == null || mimeType.isBlank()) {
            throw new IllegalArgumentException("a temporary uploaded file needs a mime type");
        }
    }

    /**
     * Validates this file against upload constraints (size + allowed extensions). Reuses the same
     * {@link UploadConstraints#validate} the endpoint runs, so a re-validation in an action sees the
     * identical rules. The extension (from {@link #clientName()}) is the non-spoofable check.
     *
     * @param constraints the rules to check against
     * @return the violation messages (empty when the file is acceptable)
     */
    public List<String> validate(UploadConstraints constraints) {
        return constraints.validate(clientName, sizeBytes);
    }

    /**
     * @return {@code true} when the mime type names an image (a previewable type)
     */
    public boolean isImage() {
        return mimeType.startsWith("image/");
    }

    /**
     * @return the lowercase file extension without the dot, or {@code null} when there is none
     */
    public String extension() {
        return UploadConstraints.extensionOf(clientName);
    }

    /**
     * Moves this temp file to permanent storage under a destination directory, via the storage SPI.
     * The component calls this once the file has validated; the returned relative path is the durable
     * reference the component persists (no ORM is assumed: the path is the adopter's to record).
     *
     * @param store the storage SPI (a local-filesystem default ships in the starter)
     * @param destinationDirectory the destination directory key (e.g. {@code "avatars"}); non-blank
     * @return the relative path the file was stored at (the permanent location)
     * @throws IllegalArgumentException if the destination directory is blank
     */
    public String store(FileStore store, String destinationDirectory) {
        if (destinationDirectory == null || destinationDirectory.isBlank()) {
            throw new IllegalArgumentException("store needs a non-blank destination directory");
        }
        return store.store(this, destinationDirectory.strip());
    }

    /**
     * @return the reference as plain JSON data (the signed token + metadata), the snapshot payload;
     *     never the bytes (state-never-code)
     */
    @Override
    public Object toWire() {
        return Map.of(
                TOKEN_KEY, token,
                NAME_KEY, clientName,
                SIZE_KEY, sizeBytes,
                MIME_KEY, mimeType);
    }

    /**
     * Rebuilds a temporary uploaded file from the map {@link #toWire()} produced (the {@link Wireable}
     * static factory the synth invokes). Tolerant of the JSON-number widening the codec applies (a
     * size may decode as an {@code Integer} or a {@code Long}).
     *
     * @param data the {@code toWire} map
     * @return the reconstructed value
     */
    @SuppressWarnings("unchecked")
    public static TemporaryUploadedFile fromWire(Object data) {
        if (!(data instanceof Map<?, ?> map)) {
            throw new IllegalArgumentException("TemporaryUploadedFile data must be a map");
        }
        Map<String, Object> m = (Map<String, Object>) map;
        return new TemporaryUploadedFile(
                String.valueOf(m.get(TOKEN_KEY)),
                String.valueOf(m.get(NAME_KEY)),
                ((Number) m.get(SIZE_KEY)).longValue(),
                String.valueOf(m.get(MIME_KEY)));
    }
}

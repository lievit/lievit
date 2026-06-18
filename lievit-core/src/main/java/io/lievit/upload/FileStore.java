/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.upload;

/**
 * The storage SPI a {@link TemporaryUploadedFile#store} call delegates to (issue #189): the
 * adopter's hook to move a validated temp upload into permanent storage. lievit ships a default
 * local-filesystem implementation in the starter ({@code LocalFileStore}); an adopter that stores to
 * object storage (GCS / S3) or a CDN implements this interface and registers it as a bean ("ship
 * defaults, adopter adapts" posture). lievit assumes no ORM and no specific storage; the SPI is the
 * single seam.
 *
 * <p>An implementation is responsible only for <em>moving the bytes</em> from the temp area named by
 * the file's signed reference to a permanent location under {@code destinationDirectory}; validation
 * (size / extension) has already run on the {@link TemporaryUploadedFile} before {@code store} is
 * called (the component validates, then stores). Pure SPI: zero Spring in the contract (ADR-0007).
 */
public interface FileStore {

    /**
     * Moves a temporary uploaded file to permanent storage under a destination directory.
     *
     * @param file the temporary uploaded file (its signed reference names the temp bytes to move)
     * @param destinationDirectory the destination directory key under the permanent root (e.g.
     *     {@code "avatars"}); a relative, traversal-free path segment
     * @return the relative path the file was stored at (the permanent location, e.g.
     *     {@code "avatars/photo.png"}), the value a component persists as the durable reference
     */
    String store(TemporaryUploadedFile file, String destinationDirectory);
}

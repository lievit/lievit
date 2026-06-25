/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.upload;

/**
 * The direct-to-object-storage SPI (issue #191, the Livewire S3 presigned-upload analogue): the
 * adopter's hook to let the browser PUT a file <strong>straight to object storage</strong> (GCS / S3
 * / R2), so the bytes never proxy through the application. lievit ships <em>no</em> cloud default
 * (it assumes no specific backend); an adopter that wants direct upload implements this interface and
 * registers it as a bean ("ship a default, adopter adapts" — here the default is "off", direct upload
 * is opt-in). With no provider bean the upload always proxies through {@code /lievit/upload} (issue
 * #159), which is the safe, backend-agnostic path.
 *
 * <p><strong>The multiple + direct constraint</strong> (Livewire's
 * {@code S3DoesntSupportMultipleFileUploads}): a presigned PUT addresses exactly one object, so a
 * single direct upload uploads one file. Multiple-file direct upload is therefore NOT a single
 * request; an adopter that needs both presigns one URL per file (the client issues N PUTs) or falls
 * back to the proxied multipart endpoint for the multiple case. lievit does not silently bundle
 * multiple files into one presigned PUT; {@link #presign} is per-file by contract.
 *
 * <p>Pure SPI, zero Spring in the contract (ADR-0007). The returned key is the durable reference the
 * component records (no ORM assumed); the bytes are in object storage, addressed by the key.
 */
public interface DirectUploadProvider {

    /**
     * Presigns a single direct PUT for one file.
     *
     * @param clientName the original file name (used to derive the object key + extension)
     * @param contentType the content type the client will PUT with (the presign may bind it)
     * @return the descriptor the client uses: where to PUT, with what method/headers, and the object
     *     key the component records once the PUT succeeds
     */
    DirectUpload presign(String clientName, String contentType);
}

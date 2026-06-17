/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.upload;

/**
 * A signed temp-file path (issue #159): the relative path under the temp root, its expiry, and the
 * opaque token the client carries as the {@code @Wire} field value. The token is the only thing that
 * crosses the wire for an uploaded file; {@link TempFileSigner#verify(String)} turns it back into the
 * verified {@link #relativePath()}.
 *
 * @param relativePath the path under the temp root (already verified safe by the signer)
 * @param expiresAtEpochSecond the Unix-epoch second the token stops verifying
 * @param token the opaque signed token {@code <pathB64>.<exp>.<sigB64>}
 */
public record SignedTempPath(String relativePath, long expiresAtEpochSecond, String token) {}

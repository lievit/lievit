/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * File-upload server primitives (Epic #34, issue #159): HMAC-signed relative temp paths
 * ({@link io.lievit.upload.TempFileSigner}), path-traversal rejection, expiry-bounded preview
 * tokens, and extension/size validation ({@link io.lievit.upload.UploadConstraints}).
 *
 * <p>These are pure (no Spring, no filesystem): the starter's upload controller composes them with
 * the actual temp storage and the HTTP routes. The wire never carries file bytes — only a signed
 * token (state-never-code, wire-protocol.md §2).
 */
@org.jspecify.annotations.NullMarked
package io.lievit.upload;

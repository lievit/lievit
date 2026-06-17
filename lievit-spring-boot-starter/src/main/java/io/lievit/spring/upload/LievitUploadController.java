/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.upload;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import io.lievit.upload.InvalidTempPathException;
import io.lievit.upload.SignedTempPath;
import io.lievit.upload.TempFileSigner;
import io.lievit.upload.UploadConstraints;

/**
 * The file-upload server hook (Epic #34, issue #159): an additive controller that takes browser file
 * uploads, validates + stores them to a temp disk, and returns a <strong>signed</strong> temp-path
 * reference per file. The {@code @Wire} property then holds only that signed token; the bytes never
 * ride the snapshot (state-never-code, wire-protocol.md §2). It is deliberately separate from the
 * unary wire dispatcher ({@link io.lievit.spring.LievitWireController}) so it adds a route, not a
 * dispatcher rewrite (ADR-0019).
 *
 * <ul>
 *   <li>{@code POST /lievit/upload} (multipart {@code files}) — validate (size + extension, the
 *       extension is the non-spoofable check, not the client mime), store under the temp root, and
 *       return {@code {"files":[{path,name,size,mime}]}} where {@code path} is the
 *       {@link SignedTempPath#token()}.
 *   <li>{@code GET /lievit/upload/preview?t=<token>} — a signed, expiry-bounded preview of a stored
 *       temp file (the 30-min preview route); the signer rejects a forged, expired, or traversal
 *       token before any file is read.
 * </ul>
 *
 * The endpoint inherits the page's security context (wire-protocol.md §7): the host app's Spring
 * Security chain covers {@code /lievit/**}, so CSRF + auth apply here as on the wire endpoint.
 */
@RestController
public final class LievitUploadController {

    private final TempFileStorage storage;
    private final TempFileSigner signer;
    private final UploadConstraints constraints;

    /**
     * @param storage the temp-file storage (filesystem by default)
     * @param signer the temp-path signer (HMAC over the relative path + expiry)
     * @param constraints the default validation rules (size + allowed extensions)
     */
    public LievitUploadController(TempFileStorage storage, TempFileSigner signer, UploadConstraints constraints) {
        this.storage = storage;
        this.signer = signer;
        this.constraints = constraints;
    }

    /** One stored file's signed reference, the JSON the client sets the {@code @Wire} field to. */
    public record UploadedRef(String path, String name, long size, String mime) {}

    /** The upload response body: the signed refs for the stored files. */
    public record UploadResponse(List<UploadedRef> files) {}

    /**
     * Handles a multipart upload of one or more files.
     *
     * @param files the uploaded parts (single or multiple)
     * @return the signed temp-path references, one per stored file
     */
    @PostMapping(path = "/lievit/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadResponse> upload(@RequestParam("files") List<MultipartFile> files) {
        List<UploadedRef> refs = new ArrayList<>();
        Instant now = Instant.now();
        for (MultipartFile file : files) {
            String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
            List<String> violations = constraints.validate(original, file.getSize());
            if (!violations.isEmpty()) {
                // Coarse 422: the client surfaces a validation error; no path internals leak.
                return ResponseEntity.unprocessableEntity().build();
            }
            String ext = UploadConstraints.extensionOf(original);
            String relative = datePrefix(now) + UUID.randomUUID() + (ext != null ? "." + ext : "");
            try {
                storage.store(relative, file.getBytes());
            } catch (IOException e) {
                throw new UncheckedIOException("failed to store upload", e);
            }
            SignedTempPath signed = signer.sign(relative, now);
            String mime = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
            refs.add(new UploadedRef(signed.token(), original, file.getSize(), mime));
        }
        return ResponseEntity.ok(new UploadResponse(refs));
    }

    /**
     * Serves a signed, expiry-bounded preview of a stored temp file.
     *
     * @param token the signed temp-path token (from the upload response)
     * @return the file bytes, or {@code 404} if the token is forged / expired / unsafe
     */
    @GetMapping("/lievit/upload/preview")
    public ResponseEntity<Resource> preview(@RequestParam("t") String token) {
        String relative = signer.verify(token); // throws if forged / expired / traversal
        Path path = storage.resolve(relative);
        if (!Files.exists(path)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().body(new FileSystemResource(path));
    }

    /**
     * Maps an invalid/forged/expired token to a {@code 404} with an empty body (fail-closed,
     * ADR-0014): the endpoint does not confirm whether a path exists to a probe.
     *
     * @param e the invalid-path exception
     * @return a {@code 404} with no body
     */
    @ExceptionHandler(InvalidTempPathException.class)
    public ResponseEntity<Void> handleInvalid(InvalidTempPathException e) {
        return ResponseEntity.notFound().build();
    }

    private static String datePrefix(Instant now) {
        return now.toString().substring(0, 7).replace('-', '/') + "/"; // yyyy/MM/
    }
}

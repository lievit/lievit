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

import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Autowired;

import io.lievit.upload.DirectUpload;
import io.lievit.upload.DirectUploadProvider;
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
 *   <li>{@code POST /lievit/upload/presign} (issue #191) — when a {@link DirectUploadProvider} bean
 *       is wired, returns a presigned direct-to-object-storage descriptor per file so the browser
 *       PUTs the bytes straight to storage (no proxy through the app). A presign is per-file by
 *       contract (the multiple+direct constraint); with no provider the endpoint is {@code 404}.
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
    private @Nullable DirectUploadProvider directProvider;

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

    /**
     * Injects the optional direct-to-object-storage provider (issue #191). Direct upload is opt-in:
     * with no {@link DirectUploadProvider} bean the presign endpoint is {@code 404} and uploads always
     * proxy through {@code /lievit/upload}. Setter injection so the provider stays optional and the
     * proxied path needs no cloud dependency.
     *
     * @param directProvider the presign provider, or {@code null} when direct upload is not configured
     */
    @Autowired(required = false)
    public void setDirectProvider(@Nullable DirectUploadProvider directProvider) {
        this.directProvider = directProvider;
    }

    /** One stored file's signed reference, the JSON the client sets the {@code @Wire} field to. */
    public record UploadedRef(String path, String name, long size, String mime) {}

    /** The upload response body: the signed refs for the stored files. */
    public record UploadResponse(List<UploadedRef> files) {}

    /** The presign request body (issue #191): the files the client wants direct-upload URLs for. */
    public record PresignRequest(List<FileToSign> files) {
        /** One file to presign: its client name and intended content type. */
        public record FileToSign(@Nullable String name, @Nullable String contentType) {}
    }

    /** The presign response body: one direct-upload descriptor per requested file. */
    public record PresignResponse(List<DirectUpload> uploads) {}

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
     * Serves a signed, expiry-bounded preview of a stored temp file. Guarded (issue #189): only a
     * previewable type (an image, by its stored extension) is served inline; a non-previewable type
     * (an executable, an archive, an office document) is rejected with {@code 404}, so the preview
     * route never hands back an arbitrary binary for inline rendering.
     *
     * @param token the signed temp-path token (from the upload response)
     * @return the image bytes inline, or {@code 404} if the token is forged / expired / unsafe / a
     *     non-previewable type
     */
    @GetMapping("/lievit/upload/preview")
    public ResponseEntity<Resource> preview(@RequestParam("t") String token) {
        String relative = signer.verify(token); // throws if forged / expired / traversal
        MediaType previewType = previewMediaType(relative);
        if (previewType == null) {
            return ResponseEntity.notFound().build();
        }
        Path path = storage.resolve(relative);
        if (!Files.exists(path)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().contentType(previewType).body(new FileSystemResource(path));
    }

    /**
     * Presigns a direct-to-object-storage upload per file (issue #191). When no
     * {@link DirectUploadProvider} bean is wired, direct upload is not configured and the endpoint is
     * {@code 404}. A presign is per-file by contract (Livewire's multiple+direct constraint): one
     * descriptor per requested file, the client issues one PUT per descriptor.
     *
     * @param request the files to presign (name + content type each)
     * @return one presigned descriptor per requested file, or {@code 404} when direct upload is off
     */
    @PostMapping(path = "/lievit/upload/presign", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<PresignResponse> presign(@org.springframework.web.bind.annotation.RequestBody PresignRequest request) {
        if (directProvider == null) {
            return ResponseEntity.notFound().build();
        }
        List<DirectUpload> uploads = new ArrayList<>();
        for (PresignRequest.FileToSign f : request.files()) {
            String name = f.name() == null || f.name().isBlank() ? "file" : f.name();
            String type = f.contentType() == null ? "application/octet-stream" : f.contentType();
            uploads.add(directProvider.presign(name, type));
        }
        return ResponseEntity.ok(new PresignResponse(uploads));
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

    /**
     * The media type to serve a previewable temp file inline, or {@code null} when the type is not
     * previewable (issue #189). Only images are previewable; their extension (server-controlled, the
     * non-spoofable signal) selects the type. Anything else is refused, so the preview route never
     * serves an arbitrary binary for inline rendering.
     */
    private static @Nullable MediaType previewMediaType(String relativePath) {
        String ext = UploadConstraints.extensionOf(relativePath);
        if (ext == null) {
            return null;
        }
        return switch (ext) {
            case "png" -> MediaType.IMAGE_PNG;
            case "jpg", "jpeg" -> MediaType.IMAGE_JPEG;
            case "gif" -> MediaType.IMAGE_GIF;
            case "webp" -> MediaType.parseMediaType("image/webp");
            case "svg" -> MediaType.parseMediaType("image/svg+xml");
            default -> null;
        };
    }
}

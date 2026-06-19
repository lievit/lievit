/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import java.util.ArrayList;
import java.util.List;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.Wire;

/**
 * {@code file-upload}: the server-first WIRE replacement for the {@code <lv-file-upload>} Lit island
 * (ADR-0012). The dropzone + the selected-file list are rendered SERVER-SIDE; the upload itself runs
 * over the wire's upload path: a native {@code <input type="file" l:upload="...">} posts the chosen
 * bytes out-of-band to the upload endpoint (runtime {@code features/uploads.ts}), the endpoint
 * returns a signed temp-file reference, and the wire sets the bound field to that reference. The
 * bytes never ride the signed snapshot (state-never-code); the field holds a reference, not the file.
 *
 * <p>WHY server-state: the island held the {@code UploadFile[]} in Lit reactive state and emitted
 * {@code lv-files-change}, leaving the actual upload entirely to the adopter ("wire to backend
 * yourself"). Here the uploaded files are a {@code @Wire} list of server-held references: the upload
 * is wired (the runtime upload directive), the list renders from server state, and a remove is a
 * {@code @LievitAction} on the server (the single owner of the list).
 *
 * <p>Runtime upload directive readiness: the wire runtime DOES ship the upload path
 * ({@code runtime/features/uploads.ts}: {@code installUploads} registers an {@code l:upload="field"}
 * directive that POSTs the files to {@code /lievit/upload}, gets back signed {@link UploadedFile}-
 * shaped refs, and sets the {@code l:model}/{@code l:upload} field). So this component uses the wire
 * upload path. The adopter still wires the SERVER half (the {@code /lievit/upload} controller that
 * validates + stores to temp + returns the signed ref); that is application-specific and out of the
 * component's scope, exactly as a real upload endpoint must be.
 *
 * <p>Selection of removed file uses the {@code $set}-style per-name action {@link #remove(String)}?
 * No: regular-action args are not forwarded over the wire, so removal is driven by a server-armed
 * id the template sets via {@code $set('pendingRemove', '<name>')} then a {@code removePending}
 * action confirms it, mirroring the kit list-page row-arm. Single-file mode keeps only the last ref.
 *
 * <p>Copied in by {@code lievit add file-upload}: the adopter OWNS this class (point {@code l:upload}
 * at a real endpoint, persist the refs on submit) AND the {@code file-upload.jte} template.
 */
@LievitComponent(template = "lievit/file-upload")
public class FileUploadComponent {

    /** A server-held uploaded-file reference (the signed temp ref the upload endpoint returned). */
    public record UploadedFile(String path, String name, long size, String mime) {}

    /** Comma-separated MIME types or extensions forwarded to the native input's accept. */
    @Wire
    public String accept = "";

    /** Allow multiple files. Locked: a client cannot widen a single-file control. */
    @Wire
    @LievitProperty(locked = true)
    public boolean multiple = false;

    /** Disables the control. */
    @Wire
    @LievitProperty(locked = true)
    public boolean disabled = false;

    /** Primary label inside the dropzone. */
    @Wire
    public String dropLabel = "Drop files here or click to browse";

    /** Constraint hint shown below the label (e.g. "PDF, max 10 MB"). */
    @Wire
    public String hint = "";

    /** Accessible label for the dropzone button. */
    @Wire
    public String label = "File upload";

    /** The file name armed for removal (the $set-armed id, confirmed by {@link #removePending()}). */
    @Wire
    public String pendingRemove = "";

    /**
     * The server-held uploaded-file references. The wire upload directive appends signed refs here as
     * uploads finish; the list renders from this server state. NOT serialized as a complex record
     * list (it is rebuilt by the upload path + read off the live instance), so it is the single
     * server-owned source of the rendered list.
     */
    @Wire
    @LievitProperty(serialize = false)
    public List<UploadedFile> files = new ArrayList<>();

    /** Removes the armed file from the server-held list (the single owner of the list). */
    @LievitAction
    void removePending() {
        if (pendingRemove == null || pendingRemove.isEmpty()) {
            return;
        }
        this.files = new ArrayList<>(files.stream().filter(f -> !f.name().equals(pendingRemove)).toList());
        this.pendingRemove = "";
    }

    /**
     * The server-held uploaded files, read by the template off the live instance ({@code _instance})
     * because a complex record list is not serialized into the snapshot.
     *
     * @return the uploaded-file references
     */
    public List<UploadedFile> files() {
        return files;
    }

    /**
     * A human-readable size for a byte count, used by the template to render each file's size.
     *
     * @param bytes the byte count
     * @return a formatted size (B / KB / MB)
     */
    public static String formatSize(long bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        }
        if (bytes < 1024 * 1024) {
            return String.format("%.1f KB", bytes / 1024.0);
        }
        return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
    }
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A markdown editor with a live preview (the filament-forms {@code MarkdownEditor} carried over):
 * binds a markdown STRING (not HTML, the difference from {@link RichEditor}), with a configurable
 * toolbar and a preview toggle. The kit carries the toolbar contract, the preview flag, and the
 * attachment-disk marker; the markdown-to-HTML preview rendering is the runtime's.
 */
public final class MarkdownEditor extends SchemaField<String, MarkdownEditor> {

    /** Filament's default markdown-editor toolbar button set, in order. */
    public static final List<String> DEFAULT_TOOLBAR_BUTTONS =
            List.of(
                    "bold",
                    "italic",
                    "strike",
                    "link",
                    "heading",
                    "bulletList",
                    "orderedList",
                    "blockquote",
                    "codeBlock",
                    "table",
                    "undo",
                    "redo");

    private final List<String> toolbarButtons = new ArrayList<>(DEFAULT_TOOLBAR_BUTTONS);
    private boolean previewable = true;
    private boolean fileAttachments;
    private @Nullable String fileAttachmentsDisk;

    private MarkdownEditor(String name) {
        super(name);
    }

    /**
     * @param name the field name and state path
     * @return a new markdown editor binding a markdown string
     */
    public static MarkdownEditor make(String name) {
        return new MarkdownEditor(name);
    }

    /**
     * Replaces the toolbar button set wholesale.
     *
     * @param buttons the buttons in display order
     * @return this field
     */
    public MarkdownEditor toolbarButtons(List<String> buttons) {
        Objects.requireNonNull(buttons, "buttons");
        toolbarButtons.clear();
        toolbarButtons.addAll(buttons);
        return this;
    }

    /**
     * Removes the named buttons from the toolbar.
     *
     * @param buttons the buttons to remove
     * @return this field
     */
    public MarkdownEditor disableToolbarButtons(List<String> buttons) {
        toolbarButtons.removeAll(Objects.requireNonNull(buttons, "buttons"));
        return this;
    }

    /**
     * @return the toolbar buttons in display order (unmodifiable)
     */
    public List<String> toolbarButtons() {
        return List.copyOf(toolbarButtons);
    }

    /**
     * Disables the live preview toggle (preview is on by default).
     *
     * @return this field
     */
    public MarkdownEditor disablePreview() {
        this.previewable = false;
        return this;
    }

    /**
     * @return {@code true} if the live preview toggle is shown (default {@code true})
     */
    public boolean isPreviewable() {
        return previewable;
    }

    /**
     * Enables inline file attachments uploaded to the given disk.
     *
     * @param disk the storage disk name the host resolves
     * @return this field
     */
    public MarkdownEditor fileAttachmentsDisk(String disk) {
        this.fileAttachments = true;
        this.fileAttachmentsDisk = Objects.requireNonNull(disk, "disk");
        return this;
    }

    /**
     * @return {@code true} if inline file attachments are enabled
     */
    public boolean hasFileAttachments() {
        return fileAttachments;
    }

    /**
     * @return the attachments disk name, or {@code null} when attachments are off
     */
    public @Nullable String fileAttachmentsDisk() {
        return fileAttachmentsDisk;
    }
}

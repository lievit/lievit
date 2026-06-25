/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A WYSIWYG rich-text editor (the filament-forms {@code RichEditor} carried over): binds an HTML
 * string, with a configurable toolbar button set and optional inline file attachments. The stored
 * value is sanitized HTML; the kit carries the toolbar contract and the attachment-disk marker, the
 * actual rendering (a Lit island over a contenteditable / ProseMirror surface) and the server-side
 * HTML sanitization are the runtime's.
 *
 * <p>The default toolbar mirrors Filament's: bold, italic, the heading/list/link/blockquote/code set.
 * {@code toolbarButtons([...])} replaces it wholesale; {@code disableToolbarButtons([...])} subtracts.
 */
public final class RichEditor extends SchemaField<String, RichEditor> {

    /** Filament's default rich-editor toolbar button set, in order. */
    public static final List<String> DEFAULT_TOOLBAR_BUTTONS =
            List.of(
                    "bold",
                    "italic",
                    "strike",
                    "link",
                    "h2",
                    "h3",
                    "bulletList",
                    "orderedList",
                    "blockquote",
                    "codeBlock",
                    "undo",
                    "redo");

    private final List<String> toolbarButtons = new ArrayList<>(DEFAULT_TOOLBAR_BUTTONS);
    private boolean fileAttachments;
    private @Nullable String fileAttachmentsDisk;

    private RichEditor(String name) {
        super(name);
    }

    /**
     * @param name the field name and state path
     * @return a new rich editor binding an HTML string
     */
    public static RichEditor make(String name) {
        return new RichEditor(name);
    }

    /**
     * Replaces the toolbar button set wholesale.
     *
     * @param buttons the buttons in display order (button names from the default set)
     * @return this field
     */
    public RichEditor toolbarButtons(List<String> buttons) {
        Objects.requireNonNull(buttons, "buttons");
        toolbarButtons.clear();
        toolbarButtons.addAll(buttons);
        return this;
    }

    /**
     * Removes the named buttons from the toolbar (keeps the rest in order).
     *
     * @param buttons the buttons to remove
     * @return this field
     */
    public RichEditor disableToolbarButtons(List<String> buttons) {
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
     * Enables inline file attachments uploaded to the given disk.
     *
     * @param disk the storage disk name the host resolves
     * @return this field
     */
    public RichEditor fileAttachmentsDisk(String disk) {
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

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.example.notes;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.Wire;
import java.util.ArrayList;
import java.util.List;

/**
 * Ephemeral in-memory note list: demonstrates stateful list mutations entirely via the wire
 * snapshot (no database). The list survives between wire calls because it is serialized into the
 * signed snapshot; it is reset on a full page reload (by design for an in-memory example).
 *
 * <p>Add a note: type in the input (l:model="newNote"), click "Add" (l:click="addNote").
 * Clear all: click "Clear" (l:click="clearNotes").
 */
@LievitComponent(template = "notes/note-list")
public class NoteListComponent {

    /** The persisted list of notes, carried in the snapshot between wire calls. */
    @Wire
    public List<String> notes = new ArrayList<>();

    /** Bound to the new-note text input (l:model). Cleared after each addNote call. */
    @Wire
    public String newNote = "";

    /** Appends the current newNote to the list and resets the input. */
    @LievitAction
    public void addNote() {
        if (newNote != null && !newNote.isBlank()) {
            notes.add(newNote.trim());
            newNote = "";
        }
    }

    /** Removes all notes from the list. */
    @LievitAction
    public void clearNotes() {
        notes.clear();
    }
}

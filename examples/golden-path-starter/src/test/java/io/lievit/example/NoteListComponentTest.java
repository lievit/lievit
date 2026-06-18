/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.example;

import static io.lievit.test.Lievit.test;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.ActiveProfiles;

import io.lievit.example.notes.NoteListComponent;
import io.lievit.test.LievitTest;

/**
 * Component tests for {@link NoteListComponent}: the full lievit wire pipeline via
 * {@link io.lievit.test.Lievit#test(Class)} (ADR-0010).
 */
@LievitTest(classes = GoldenPathApp.class)
@ActiveProfiles("test")
class NoteListComponentTest {

    /**
     * @spec.given a freshly mounted NoteListComponent
     * @spec.when the component is mounted
     * @spec.then the notes list is empty and the "no notes" message is visible
     */
    @Test
    void mounts_with_empty_note_list() {
        test(NoteListComponent.class)
                .mount()
                .assertWire("notes.size", 0)
                .assertSee("No notes yet");
    }

    /**
     * @spec.given a mounted NoteListComponent with a note typed into the input
     * @spec.when addNote is called
     * @spec.then the note appears in the list and the input is cleared
     */
    @Test
    void adding_a_note_appends_to_the_list_and_clears_the_input() {
        test(NoteListComponent.class)
                .mount()
                .assertWire("notes.size", 0)
                .model("newNote", "buy milk")
                .call("addNote")
                .assertWire("notes.size", 1)
                .assertWire("newNote", "")
                .assertSee("buy milk")
                .assertSnapshotRotated();
    }

    /**
     * @spec.given a NoteListComponent with two notes
     * @spec.when clearNotes is called
     * @spec.then the list is empty and the "no notes" message is visible again
     */
    @Test
    void clearing_notes_empties_the_list() {
        test(NoteListComponent.class)
                .mount()
                .model("newNote", "note one")
                .call("addNote")
                .model("newNote", "note two")
                .call("addNote")
                .assertWire("notes.size", 2)
                .call("clearNotes")
                .assertWire("notes.size", 0)
                .assertSee("No notes yet");
    }

    /**
     * @spec.given a mounted NoteListComponent
     * @spec.when addNote is called with a blank input
     * @spec.then the list remains empty (blank notes are ignored)
     */
    @Test
    void blank_note_is_not_added() {
        test(NoteListComponent.class)
                .mount()
                .model("newNote", "   ")
                .call("addNote")
                .assertWire("notes.size", 0);
    }

    /**
     * @spec.given a NoteListComponent accumulating notes across multiple calls
     * @spec.when two notes are added in sequence
     * @spec.then both appear in the rendered HTML in order
     */
    @Test
    void multiple_notes_appear_in_order() {
        test(NoteListComponent.class)
                .mount()
                .model("newNote", "first")
                .call("addNote")
                .model("newNote", "second")
                .call("addNote")
                .assertSeeInOrder("first", "second");
    }
}

@import dev.lievit.component.ComponentMetadata
@import java.util.List
@param List<String> notes
@param String newNote
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <h2>Notes <span data-note-count>(${notes.size()})</span></h2>
    @if(notes.isEmpty())
        <p data-notes-empty>No notes yet. Add one below.</p>
    @else
        <ul data-note-list>
            @for(String note : notes)
                <li data-note>${note}</li>
            @endfor
        </ul>
    @endif
    <div>
        <input type="text" value="${newNote}" l:model="newNote"
               placeholder="Type a note..." data-note-input>
        <button type="button" l:click="addNote" data-add-note>Add</button>
        @if(!notes.isEmpty())
            <button type="button" l:click="clearNotes" data-clear-notes>Clear all</button>
        @endif
    </div>
</div>

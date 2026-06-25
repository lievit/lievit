@import dev.lievit.component.ComponentMetadata
@import dev.lievit.wire.FileUploadComponent
@import dev.lievit.wire.FileUploadComponent.UploadedFile
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui file-upload WIRE template -- a server-rendered dropzone + file list whose upload runs
  over the wire upload path (ADR-0012). Pairs with registry/wire/file-upload/FileUploadComponent.java.

  TIER: WIRE. The dropzone + the selected-file list are server-rendered HTML. The upload itself is
  the wire runtime's upload directive: the native <input type="file" l:upload="files"> POSTs the
  chosen bytes out-of-band to the upload endpoint (runtime features/uploads.ts), which returns a
  signed temp-file reference; the wire sets the bound `files` field to that reference and re-renders
  this list. The bytes never ride the snapshot (state-never-code), only the reference does. A remove
  arms the file name via $set then a confirm action drops it from the server-held list. No <slot>.

  Runtime upload directive: READY (runtime/features/uploads.ts installs l:upload). The adopter wires
  the SERVER half (the /lievit/upload controller that stores to temp + returns the signed ref); that
  is application-specific. If you prefer a plain multipart POST instead of the wire upload, swap the
  l:upload input for <input type="file" name="..."> inside a <form method="post" enctype=
  "multipart/form-data"> and handle the upload in a controller (the partial recipe).

  STRUCTURE (scientific decision rule): WAI-ARIA APG dropzone-as-button + a labelled file list (the
  model the dropped island cited): the zone is role="button" tabindex=0 with aria-describedby -> the
  hint; the native <input type=file> is visually hidden but reachable; each file row has a labelled
  remove button. Native input + l:upload beats a custom uploader: the platform owns the file picker
  and drag-drop, the wire owns the transport, the server owns the list.

  A11y: div[role=button][aria-label][aria-describedby], visually-hidden input[type=file],
  ul[aria-label="Selected files"] with per-row aria-label="Remove <name>".

  Params:
    accept        String   comma-separated MIME types / extensions for the native input
    multiple      boolean  allow multiple files (locked)
    disabled      boolean  disable the control (locked)
    dropLabel     String   primary label inside the dropzone
    hint          String   constraint hint below the label
    label         String   accessible label for the dropzone button
    pendingRemove String   the file name armed for removal (set via $set, confirmed by removePending)
    _instance     FileUploadComponent  the live instance (reads the server-held file list)
    _component    ComponentMetadata    always-present wire metadata (the className anchor)

  Usage (copy this template in, point l:upload at your endpoint, persist refs on submit):
    register FileUploadComponent as a PROTOTYPE @Bean; install the wire upload runtime; mount it.
--%>
@param String accept
@param boolean multiple
@param boolean disabled
@param String dropLabel
@param String hint
@param String label
@param String pendingRemove
@param FileUploadComponent _instance
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var inputId = "lv-file-input";}
!{var hintId = "lv-file-hint";}
!{List<UploadedFile> files = _instance.files();}
<div data-lievit-component="${cid}" data-file-upload data-controller="lv-file-upload" data-action="lievit:upload-progress->lv-file-upload#progress" style="display: block; font-family: var(--lv-font-sans);">
    <input
        id="${inputId}"
        type="file"
        accept="${accept}"
        multiple="${multiple}"
        disabled="${disabled}"
        l:upload="files"
        data-file-upload-input
        data-lv-file-upload-target="input"
        data-action="change->lv-file-upload#change"
        style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); border: 0;"
    />

    <label
        for="${inputId}"
        role="button"
        tabindex="${disabled ? "-1" : "0"}"
        aria-label="${label}"
        aria-describedby="${hint.isEmpty() ? "" : hintId}"
        aria-disabled="${disabled ? "true" : "false"}"
        data-file-upload-zone
        data-lv-file-upload-target="zone"
        data-action="dragover->lv-file-upload#dragOver dragleave->lv-file-upload#dragLeave drop->lv-file-upload#drop"
        style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--lv-space-2); padding: var(--lv-space-5) var(--lv-space-4); border: 2px dashed var(--lv-color-border); border-radius: var(--lv-radius-md); background: var(--lv-color-surface); cursor: ${disabled ? "not-allowed" : "pointer"}; opacity: ${disabled ? "0.5" : "1"}; text-align: center;"
    >
        <span aria-hidden="true" style="color: var(--lv-color-muted);">
            @template.icon(name = "upload", size = "1.75rem")
        </span>
        <span data-file-upload-label style="font-size: var(--lv-text-sm); color: var(--lv-color-fg);">${dropLabel}</span>
        @if(!hint.isEmpty())
            <span id="${hintId}" style="font-size: var(--lv-text-sm); color: var(--lv-color-muted);">${hint}</span>
        @endif
    </label>

    @if(!files.isEmpty())
        <ul aria-label="Selected files" data-file-upload-list style="list-style: none; padding: 0; margin: var(--lv-space-2) 0 0; display: flex; flex-direction: column; gap: var(--lv-space-1);">
            @for(UploadedFile file : files)
                <li data-file-upload-item="${file.name()}" style="display: flex; align-items: center; justify-content: space-between; padding: var(--lv-space-2) var(--lv-space-3); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); font-size: var(--lv-text-sm); color: var(--lv-color-fg);">
                    <span data-file-upload-item-name style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.name()}</span>
                    <span style="color: var(--lv-color-muted); margin: 0 var(--lv-space-2); white-space: nowrap;">${FileUploadComponent.formatSize(file.size())}</span>
                    @if(pendingRemove.equals(file.name()))
                        <button type="button" l:click="removePending" aria-label="Confirm remove ${file.name()}" data-file-upload-confirm-remove style="background: transparent; border: 0; cursor: pointer; color: var(--lv-color-danger); font-size: var(--lv-text-sm); padding: 0 var(--lv-space-1);">Confirm</button>
                    @else
                        <button type="button" l:click="$set('pendingRemove', '${file.name()}')" aria-label="Remove ${file.name()}" data-file-upload-remove="${file.name()}" style="background: transparent; border: 0; cursor: pointer; color: var(--lv-color-muted); font-size: var(--lv-text-sm); padding: 0 var(--lv-space-1);">
                            @template.icon(name = "x", size = "0.875rem")
                        </button>
                    @endif
                </li>
            @endfor
        </ul>
    @endif
</div>

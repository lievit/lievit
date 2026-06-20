/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.Wire;

/**
 * {@code rich-select}: the server-first WIRE replacement for the {@code <lv-rich-select>} Lit island
 * (ADR-0012), grown into a full Filament-{@code Select}-parity Combobox (roadmap L1). A searchable
 * select whose options are filtered SERVER-SIDE: the query binds {@code l:model.debounce} so a few
 * hundred ms after the last keystroke the server re-filters the option list and re-renders the
 * listbox. There is no client-side filtering, no shipped options array in the browser: this is the
 * canonical htmx/wire typeahead (blueprint §1.b + ADR-0012's wire optimization toolkit).
 *
 * <p>Filament parity (the four L1 behaviours, all kept server-first):
 *
 * <ul>
 *   <li><b>multiple</b> ({@link #multiple}): toggles membership of a value in {@link #selectedValues}
 *       instead of replacing {@link #selected}; the chosen options render as removable CHIPS, each a
 *       real {@code <button>} that arms the same toggle to remove itself. Single mode (the original
 *       {@link #selected} string) is unchanged for back-compat.
 *   <li><b>preload</b> ({@link #preload}): when true the listbox shows the full (or top-N) catalog on
 *       mount without a query (the eager path for SMALL sets); when false the existing on-demand
 *       debounced search (the lazy path for LARGE sets). Guidance: small set -> preload, large set ->
 *       lazy search ({@code getSearchResultsUsing} territory).
 *   <li><b>create-option</b> ({@link #allowCreate}): when the query matches no existing option, a
 *       "Create &quot;&lt;query&gt;&quot;" affordance arms {@link #createValue} and the next render
 *       adds the typed value as a new selected option (value creation only; a full create-FORM modal
 *       is out of scope, the adopter wires {@code createOptionUsing} server-side).
 *   <li><b>rich labels</b>: {@link Option} carries an optional leading {@link Option#avatar} (image
 *       URL) / {@link Option#icon} (Lucide name) + a {@link Option#subtext} secondary line; the
 *       template renders {@code [avatar] label / subtext}. The original {@code value} / {@code label}
 *       / {@code description} / {@code disabled} are unchanged.
 * </ul>
 *
 * <p>WHY server-state: the island held {@code options}, {@code value}, {@code query} and the open
 * state in Lit reactive properties and filtered in the browser; the selection rode a hidden mirror
 * input that the gest bug note records was NOT reliably form-associated. Here the selected value(s)
 * are {@code @Wire} state round-tripped in the signed snapshot, the query is a {@code @Wire} string
 * the debounced model binds, and the rendered options are a {@code serialize = false} view rebuilt
 * from {@link #allOptions} on every render: the selection cannot be lost and the filter cannot fail
 * silently in client code.
 *
 * <p>The full option catalog ({@link #allOptions}) is server-held authoritative data (a real adopter
 * seeds it from a repository in the constructor / a {@code @LievitRender} hook); it is
 * {@code serialize = false} so it never rides the snapshot. {@link #visibleOptions} is the
 * server-filtered subset the template renders, also derived (never serialized).
 *
 * <p>Interaction over the wire: a regular {@code @LievitAction} cannot receive the clicked value as
 * an argument (regular-action args are not forwarded over the wire, runtime parity gap), so the
 * clicked value is ARMED into a {@code @Wire} string via the magic {@code $set} and consumed on the
 * next render, the same idiom {@code toggle-group} uses:
 *
 * <ul>
 *   <li>single mode picks via {@code $set('selected', '<value>')} (unchanged);
 *   <li>multiple mode toggles via {@code $set('toggleValue', '<value>')} -> {@link #applyWire()}
 *       flips membership of that value in {@link #selectedValues} and clears the arm (a chip's remove
 *       button arms the SAME toggle, since toggling an already-selected value removes it);
 *   <li>create arms {@code $set('createValue', '<query>')} -> {@link #applyWire()} adds the typed
 *       value as a new option + selects it, then clears the arm.
 * </ul>
 *
 * The consume-and-clear render hook makes every interaction one round-trip and idempotent under
 * replay (a re-render carrying a cleared arm never double-applies).
 *
 * <p>Copied in by {@code lievit add rich-select}: the adopter OWNS this class (seed {@link
 * #allOptions} from real data, add server-side authz on selection, wire {@code createOptionUsing})
 * AND the {@code rich-select.jte} template.
 */
@LievitComponent(template = "lievit/rich-select")
public class RichSelectComponent {

    /**
     * One selectable option. A plain record: server-side data, never serialized to the client. The
     * rich-label fields ({@link #avatar} image URL, {@link #icon} Lucide name, {@link #subtext}
     * secondary line) are all optional (empty string = absent).
     */
    public record Option(
            String value,
            String label,
            String description,
            boolean disabled,
            String avatar,
            String icon,
            String subtext) {
        /**
         * @param value the submit value
         * @param label the human label
         * @return an enabled option with no description, avatar, icon or subtext
         */
        public static Option of(String value, String label) {
            return new Option(value, label, "", false, "", "", "");
        }

        /**
         * A rich option with a leading Lucide icon + a secondary subtext line.
         *
         * @param value the submit value
         * @param label the human label
         * @param icon the leading Lucide icon name (empty for none)
         * @param subtext the secondary line under the label (empty for none)
         * @return an enabled rich option
         */
        public static Option rich(String value, String label, String icon, String subtext) {
            return new Option(value, label, "", false, "", icon, subtext);
        }
    }

    /** Form field name the selected value submits under (server-owned, locked). */
    @Wire
    @LievitProperty(locked = true)
    public String name = "";

    /** The live search query. Bound by {@code l:model.debounce} so typing re-filters server-side. */
    @Wire
    public String query = "";

    /**
     * The selected option value in SINGLE mode, held server-side. Set via
     * {@code $set('selected', '...')}. Ignored when {@link #multiple} is true (see
     * {@link #selectedValues}).
     */
    @Wire
    public String selected = "";

    /**
     * The selected option values in MULTIPLE mode, held server-side as a plain JSON list. Membership
     * is toggled via the armed {@link #toggleValue}; the chosen options render as removable chips.
     */
    @Wire
    public List<String> selectedValues = new ArrayList<>();

    /**
     * Multiple-selection mode: when true the control toggles membership in {@link #selectedValues}
     * and renders chips; when false (default, back-compat) it is the original single {@link #selected}
     * typeahead. Locked: the selection mode is server policy.
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean multiple = false;

    /**
     * Preload mode: when true the listbox shows the full catalog on mount with no query (the eager
     * path for SMALL option sets); when false (default) the on-demand debounced search (the lazy path
     * for LARGE sets, where the adopter narrows server-side per keystroke). Locked: server policy.
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean preload = false;

    /**
     * Allow-create: when true and the trimmed query matches no existing option, a "Create" affordance
     * arms {@link #createValue} to add the typed value as a new selected option. Locked: server policy
     * (the adopter decides whether ad-hoc values are permitted).
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean allowCreate = false;

    /** Placeholder shown on the trigger when nothing is selected. */
    @Wire
    public String placeholder = "Select...";

    /** Placeholder inside the search input. */
    @Wire
    public String searchPlaceholder = "Search...";

    /** Accessible label for the combobox + listbox. */
    @Wire
    public String label = "";

    /** Disables the control: no selection, dimmed. */
    @Wire
    @LievitProperty(locked = true)
    public boolean disabled = false;

    /**
     * The value a click just armed (the {@code $set} magic). In multiple mode it is the value to
     * toggle in {@link #selectedValues}; a chip's remove button arms the same value (toggling a
     * selected value removes it). Consumed + cleared by {@link #applyWire()} on the next render, so
     * the interaction is one round-trip and idempotent. Empty when nothing is pending.
     */
    @Wire
    public String toggleValue = "";

    /**
     * The query a "Create" click armed (the {@code $set} magic), to be added as a new option +
     * selected. Consumed + cleared by {@link #applyWire()} on the next render. Empty when nothing is
     * pending; honoured only when {@link #allowCreate} is true.
     */
    @Wire
    public String createValue = "";

    /**
     * The full, authoritative option catalog. Server-held, NOT serialized: a real adopter replaces
     * this seed with a repository read (constructor or {@code @LievitRender}). It never rides the
     * snapshot, so the browser never holds the catalog and cannot filter client-side. A created
     * option (allow-create) is appended here so it renders + round-trips as a normal option.
     */
    @Wire
    @LievitProperty(serialize = false)
    public List<Option> allOptions =
            new ArrayList<>(
                    List.of(
                            Option.of("apple", "Apple"),
                            Option.of("banana", "Banana"),
                            Option.of("cherry", "Cherry")));

    /**
     * The server-filtered options the template renders. Derived from {@link #allOptions} + {@link
     * #query} on every render; NOT serialized (a complex record list cannot round-trip the generic
     * snapshot codec, and it is pure derived state anyway).
     */
    @Wire
    @LievitProperty(serialize = false)
    List<Option> visibleOptions = List.of();

    /**
     * Applies the armed wire commands ({@link #toggleValue} membership toggle, {@link #createValue}
     * create) on mount and before every re-render, then clears the arms. A {@code @LievitRender}
     * (not {@code @LievitMount}) because the order is updates-then-render and the arms must be
     * consumed exactly once per round-trip; an empty / unknown arm is a no-op, so a bare re-render
     * (or a snapshot replay carrying a cleared arm) never double-applies: idempotent. Runs the create
     * BEFORE the filter so a freshly created option is visible, then re-derives {@link
     * #visibleOptions}.
     */
    @LievitRender
    void applyWire() {
        applyCreate();
        applyToggle();
        refilter();
    }

    /** Adds the armed created value as a new option + selects it (allow-create only), then clears. */
    private void applyCreate() {
        String created = createValue == null ? "" : createValue.trim();
        if (allowCreate && !disabled && !created.isEmpty() && findOption(created) == null) {
            allOptions.add(Option.of(created, created));
            select(created);
        }
        createValue = "";
    }

    /** Flips the armed toggle value in the selection (multiple) or sets it (single), then clears. */
    private void applyToggle() {
        String armed = toggleValue == null ? "" : toggleValue;
        if (canSelect(armed)) {
            toggle(armed);
        }
        toggleValue = "";
    }

    /** Re-derives the rendered options from the query (or the whole catalog under preload). */
    private void refilter() {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (q.isEmpty()) {
            // preload + no query renders the full catalog; without preload, also full (the panel is
            // already open in this server-rendered model, so "no query" means "show everything").
            this.visibleOptions = List.copyOf(allOptions);
            return;
        }
        List<Option> matched = new ArrayList<>();
        for (Option o : allOptions) {
            if (o.label().toLowerCase(Locale.ROOT).contains(q)
                    || o.description().toLowerCase(Locale.ROOT).contains(q)
                    || o.subtext().toLowerCase(Locale.ROOT).contains(q)) {
                matched.add(o);
            }
        }
        this.visibleOptions = List.copyOf(matched);
    }

    /** Whether a value names a real, enabled option the user may currently pick. */
    private boolean canSelect(String value) {
        Option o = findOption(value);
        return !disabled && value != null && !value.isEmpty() && o != null && !o.disabled();
    }

    /** Single mode sets the value; multiple mode toggles its membership in the selection set. */
    private void toggle(String value) {
        if (multiple) {
            if (selectedValues.contains(value)) {
                selectedValues.remove(value);
            } else {
                selectedValues.add(value);
            }
        } else {
            select(value);
        }
    }

    /** Selects a value (multiple: add to the set; single: replace). Used by create + single pick. */
    private void select(String value) {
        if (multiple) {
            if (!selectedValues.contains(value)) {
                selectedValues.add(value);
            }
        } else {
            this.selected = value;
        }
    }

    /** The catalog option with this value, or null when none matches. */
    private Option findOption(String value) {
        for (Option o : allOptions) {
            if (o.value().equals(value)) {
                return o;
            }
        }
        return null;
    }

    /**
     * The label of the currently selected option in SINGLE mode, or an empty string when nothing is
     * selected. Read by the template off the live instance to render the trigger text.
     *
     * @return the selected option's label, or empty when none is selected (or in multiple mode)
     */
    public String selectedLabel() {
        Option o = findOption(selected);
        return o == null ? "" : o.label();
    }

    /**
     * The chosen options in MULTIPLE mode, in selection order, read by the template to render the
     * removable chips. Skips any selected value no longer in the catalog (defensive).
     *
     * @return the selected options as records, for chip rendering
     */
    public List<Option> selectedOptions() {
        List<Option> chosen = new ArrayList<>();
        for (String v : selectedValues) {
            Option o = findOption(v);
            if (o != null) {
                chosen.add(o);
            }
        }
        return List.copyOf(chosen);
    }

    /**
     * Whether a value is currently selected (read by the template for {@code aria-selected}); honours
     * single ({@link #selected}) vs multiple ({@link #selectedValues}) mode.
     *
     * @param value the option value
     * @return true when the value is the current single selection or a member of the multiple set
     */
    public boolean isChosen(String value) {
        return multiple ? selectedValues.contains(value) : selected.equals(value);
    }

    /**
     * Whether the current trimmed query matches NO existing option, so the "Create" affordance should
     * render (allow-create only). Read by the template.
     *
     * @return true when allow-create is on and the typed query is a new, non-empty value
     */
    public boolean canCreate() {
        String q = query == null ? "" : query.trim();
        return allowCreate && !disabled && !q.isEmpty() && findOption(q) == null;
    }

    /**
     * The trimmed query, the candidate value the "Create" affordance would add. Read by the template
     * to render the {@code Create "<query>"} label + arm.
     *
     * @return the trimmed query
     */
    public String createCandidate() {
        return query == null ? "" : query.trim();
    }

    /**
     * The server-filtered options to render. Read by the template off the live instance ({@code
     * _instance}) because a complex record list is not serialized into the snapshot.
     *
     * @return the options matching the current query
     */
    public List<Option> visibleOptions() {
        return visibleOptions;
    }
}

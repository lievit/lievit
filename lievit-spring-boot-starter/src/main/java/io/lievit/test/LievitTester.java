/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Predicate;

import org.jspecify.annotations.Nullable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lievit.component.ComponentMetadata;
import io.lievit.component.WireDispatcher;
import io.lievit.spring.ComponentRegistry;
import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;
import io.lievit.test.Rejections.Rejection;
import io.lievit.wire.Snapshot;
import io.lievit.wire.SnapshotCodec;
import io.lievit.wire.WireError;

/**
 * The fluent component tester returned by {@link Lievit#test(Class)} (ADR-0010): it drives one
 * developer component through the <strong>real</strong> wire pipeline, headless, and exposes typed,
 * boilerplate-free assertions over the state, the re-rendered HTML, and the security boundary.
 *
 * <p>Lifecycle mirrors the browser's, with the snapshot hidden: {@link #mount()} builds and signs
 * the first snapshot; {@link #model(String, Object)} / {@link #tamperUpdate(String, Object)} stage a
 * client {@code _updates} entry; {@link #call(String)} POSTs {@code {_snapshot, _updates, _calls}}
 * to the {@code /lievit/{id}/call} HTTP edge over {@code MockMvc} and carries the fresh signed
 * snapshot forward. State read-back ({@link #assertWire}) re-verifies the live snapshot with the
 * real codec, so it reads exactly what the wire carries.
 *
 * <p>Failure messages name the call sequence that produced the state (the lievit "looks done = is
 * done" DX): {@code expected @Wire count == 1 but was 0 after calls [increment]}.
 *
 * @param <T> the component type (so {@link #assertWireMatches} hands back a typed instance)
 */
public final class LievitTester<T> {

    private final Class<T> componentType;
    private final String className;
    private final MockMvc mockMvc;
    private final ObjectMapper json;
    private final SnapshotCodec codec;
    private final ComponentRegistry registry;
    private final WireDispatcher dispatcher;
    private final LievitWireService wireService;

    private final Map<String, Object> pendingUpdates = new LinkedHashMap<>();
    private final List<String> callHistory = new ArrayList<>();

    // A per-tester client key so each test's checksum-failure budget is independent: the rate-limit
    // is keyed on the client, so one test's forged-snapshot probes must not spend another test's
    // budget through the shared limiter bean. Sent as X-Forwarded-For, which the edge keys on.
    private static final AtomicLong CLIENT_SEQ = new AtomicLong();
    private final String clientKey = "10.0.0." + (CLIENT_SEQ.incrementAndGet() & 0xFFFFFF);

    private String snapshot;
    private String html = "";
    private boolean forgeNextSnapshot;

    // Validation errors from the last successful call's Lievit-Effects header, or null if none.
    private @Nullable Map<String, List<String>> lastErrors;

    // The full parsed Lievit-Effects JSON from the last successful call (or null). Used by the
    // domain test helpers to read dispatched events (e.g. the admin-notify toast).
    private @Nullable JsonNode lastEffects;

    private boolean rejected;
    private int rejectionStatus;
    private String rejectionReason = "";

    LievitTester(Class<T> componentType, LievitTestContext context) {
        this.componentType = componentType;
        this.className = componentType.getName();
        this.mockMvc = context.mockMvc();
        var ctx = context.applicationContext();
        this.json = ctx.getBeanProvider(ObjectMapper.class).getIfAvailable(ObjectMapper::new);
        this.codec = ctx.getBean(SnapshotCodec.class);
        this.registry = ctx.getBean(ComponentRegistry.class);
        this.dispatcher = ctx.getBean(WireDispatcher.class);
        this.wireService = ctx.getBean(LievitWireService.class);
    }

    // --- lifecycle -------------------------------------------------------------------------------

    /**
     * Mounts the component for the first page load over the real pipeline: build, run
     * {@code @LievitMount}, render, sign the initial snapshot.
     *
     * @return this tester, now holding the initial HTML and signed snapshot
     */
    public LievitTester<T> mount() {
        WireCallResult mounted = wireService.mount(className);
        this.html = mounted.html();
        this.snapshot = mounted.snapshot();
        this.rejected = false;
        return this;
    }

    /**
     * Stages a client {@code _updates} entry for a bound field, as a real keystroke would carry it
     * on the wire (the deferred-model intent: it rides with the next {@link #call(String)}).
     *
     * @param field the {@code @Wire} field name
     * @param value the value the client sends
     * @return this tester
     */
    public LievitTester<T> model(String field, Object value) {
        pendingUpdates.put(field, value);
        return this;
    }

    /**
     * Stages a <strong>hostile</strong> {@code _updates} entry, from the attacker's seat: a client
     * trying to write a field it must not (typically a {@code locked} one). Identical on the wire to
     * {@link #model}; named differently so the test reads as an attack and pairs with
     * {@link #assertRejected(Class)}.
     *
     * @param field the field the client is trying to write
     * @param value the value the attacker sends
     * @return this tester
     */
    public LievitTester<T> tamperUpdate(String field, Object value) {
        pendingUpdates.put(field, value);
        return this;
    }

    /**
     * Forges the snapshot the next {@link #call}/{@link #callExpectingRejection} carries (flips a
     * payload byte so the HMAC fails), to drive the signature-failure / rate-limit path from the
     * attacker's seat.
     *
     * @return this tester
     */
    public LievitTester<T> forgeSnapshot() {
        this.forgeNextSnapshot = true;
        return this;
    }

    /**
     * Runs one wire call: POST {@code {_snapshot, _updates, _calls:[action]}} to the real HTTP edge.
     * On success the fresh signed snapshot and re-rendered HTML are carried forward and the staged
     * updates are cleared; on a rejection the terminal status + {@code Lievit-Reason} are recorded
     * for {@link #assertRejected(Class)}.
     *
     * @param action the {@code @LievitAction} name to invoke
     * @return this tester
     */
    public LievitTester<T> call(String action) {
        return perform(List.of(action));
    }

    /**
     * Syncs the staged {@link #model} updates with <em>no</em> action: a live {@code wire:model.live}
     * / {@code .blur} round trip (ADR-0038). This is the real-time per-field validation path: the
     * server validates only the updated fields and surfaces only their errors, never the still-empty
     * neighbours' errors. Pairs with {@link #assertHasError} / {@link #assertNoErrors}.
     *
     * @return this tester
     */
    public LievitTester<T> update() {
        return perform(List.of());
    }

    /**
     * Runs a wire call with <em>no</em> action, expected to be rejected before any action would run
     * (the rate-limit / forged-snapshot probe). Equivalent to {@code call} with an empty
     * {@code _calls} list; reads clearly in a brute-force loop.
     *
     * @return this tester
     */
    public LievitTester<T> callExpectingRejection() {
        return perform(List.of());
    }

    private LievitTester<T> perform(List<String> calls) {
        String outboundSnapshot = forgeNextSnapshot ? forge(snapshot) : snapshot;
        this.forgeNextSnapshot = false;

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("_snapshot", outboundSnapshot);
        body.put("_updates", new LinkedHashMap<>(pendingUpdates));
        body.put("_calls", calls);

        MvcResult result;
        try {
            result =
                    mockMvc.perform(
                                    post("/lievit/{id}/call", "lievit-tester")
                                            .header("X-Forwarded-For", clientKey)
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(json.writeValueAsString(body)))
                            .andReturn();
        } catch (Exception e) {
            throw new IllegalStateException("the wire call could not be performed", e);
        }

        int status = result.getResponse().getStatus();
        if (status == 200) {
            this.rejected = false;
            this.html = bodyOf(result);
            String fresh = result.getResponse().getHeader("Lievit-Snapshot");
            if (fresh != null) {
                this.snapshot = fresh;
            }
            String effectsHeader = result.getResponse().getHeader("Lievit-Effects");
            this.lastErrors = parseErrors(effectsHeader);
            this.lastEffects = parseEffects(effectsHeader);
            this.callHistory.addAll(calls);
            this.pendingUpdates.clear();
        } else {
            this.rejected = true;
            this.rejectionStatus = status;
            String reason = result.getResponse().getHeader("Lievit-Reason");
            this.rejectionReason = reason == null ? "" : reason;
            // A rejected call consumes the staged updates too: a fresh interaction stages new ones.
            this.pendingUpdates.clear();
        }
        return this;
    }

    // --- state assertions ------------------------------------------------------------------------

    /**
     * Asserts a bound field equals an expected value, reading the typed state back from the live
     * signed snapshot. Supports dotted navigation into nested maps and a {@code .size} suffix on a
     * collection or map (e.g. {@code "results.size"}).
     *
     * @param path the field path ({@code "count"}, {@code "results.size"}, {@code "user.name"})
     * @param expected the expected value
     * @return this tester
     */
    public LievitTester<T> assertWire(String path, Object expected) {
        requireNotRejected("assertWire(\"" + path + "\", …)");
        Object actual = navigate(wireState(), path);
        if (!valuesEqual(expected, actual)) {
            throw new AssertionError(
                    "expected @Wire "
                            + path
                            + " == "
                            + render(expected)
                            + " but was "
                            + render(actual)
                            + afterCalls());
        }
        return this;
    }

    /**
     * Asserts a typed predicate over the <strong>real rehydrated component instance</strong> (no
     * stringly view bag): the snapshot state is replayed onto a fresh instance through the real
     * dispatcher, then the predicate is tested.
     *
     * @param predicate the assertion over the rehydrated instance
     * @return this tester
     */
    public LievitTester<T> assertWireMatches(Predicate<T> predicate) {
        requireNotRejected("assertWireMatches(…)");
        T instance = rehydratedInstance();
        if (!predicate.test(instance)) {
            throw new AssertionError(
                    "expected the rehydrated " + componentType.getSimpleName()
                            + " to match the predicate, but it did not" + afterCalls());
        }
        return this;
    }

    // --- HTML assertions -------------------------------------------------------------------------

    /**
     * Asserts the re-rendered HTML contains a fragment.
     *
     * @param fragment the substring expected in the rendered HTML
     * @return this tester
     */
    public LievitTester<T> assertSee(String fragment) {
        requireNotRejected("assertSee(\"" + fragment + "\")");
        if (!html.contains(fragment)) {
            throw new AssertionError(
                    "expected the rendered HTML to contain " + render(fragment) + afterCalls()
                            + " — actual HTML:\n" + html);
        }
        return this;
    }

    /**
     * Asserts the re-rendered HTML does <em>not</em> contain a fragment.
     *
     * @param fragment the substring that must be absent
     * @return this tester
     */
    public LievitTester<T> assertDontSee(String fragment) {
        requireNotRejected("assertDontSee(\"" + fragment + "\")");
        if (html.contains(fragment)) {
            throw new AssertionError(
                    "expected the rendered HTML NOT to contain " + render(fragment) + afterCalls()
                            + " — actual HTML:\n" + html);
        }
        return this;
    }

    /**
     * Asserts the re-rendered HTML contains a raw HTML fragment (alias of {@link #assertSee} kept
     * for Livewire parity and reading intent: the fragment is markup, not text).
     *
     * @param htmlFragment the HTML substring expected
     * @return this tester
     */
    public LievitTester<T> assertSeeHtml(String htmlFragment) {
        return assertSee(htmlFragment);
    }

    /**
     * Asserts several fragments appear in the rendered HTML in the given order.
     *
     * @param fragments the fragments expected in order
     * @return this tester
     */
    public LievitTester<T> assertSeeInOrder(String... fragments) {
        requireNotRejected("assertSeeInOrder(…)");
        int cursor = 0;
        for (String fragment : fragments) {
            int at = html.indexOf(fragment, cursor);
            if (at < 0) {
                throw new AssertionError(
                        "expected the rendered HTML to contain "
                                + render(fragment)
                                + " after the previous fragment"
                                + afterCalls()
                                + " — actual HTML:\n"
                                + html);
            }
            cursor = at + fragment.length();
        }
        return this;
    }

    // --- snapshot assertions ---------------------------------------------------------------------

    /**
     * Asserts the last successful call returned a fresh, well-signed snapshot distinct from the one
     * carried in (the wire rotated, as the browser would see).
     *
     * @return this tester
     */
    public LievitTester<T> assertSnapshotRotated() {
        requireNotRejected("assertSnapshotRotated()");
        if (callHistory.isEmpty()) {
            throw new AssertionError(
                    "assertSnapshotRotated() needs a prior successful call: nothing has rotated the"
                            + " mount snapshot yet");
        }
        assertSnapshotValid();
        return this;
    }

    /**
     * Asserts the current snapshot verifies against the real codec (well-signed, not expired).
     *
     * @return this tester
     */
    public LievitTester<T> assertSnapshotValid() {
        try {
            codec.verify(snapshot, Instant.now());
        } catch (RuntimeException e) {
            throw new AssertionError(
                    "expected the current snapshot to be valid but the codec rejected it: "
                            + e.getMessage());
        }
        return this;
    }

    // --- rejection assertions --------------------------------------------------------------------

    /**
     * Asserts the last call was rejected with a specific terminal reason, from the wire's error-code
     * state machine — including {@link Rejections.LockedProperty} (403, attacker's seat) and {@link
     * Rejections.TooManyFailures} (429), the two Livewire's own component tester cannot reach.
     *
     * @param token the expected rejection type (see {@link Rejections})
     * @return this tester
     */
    public LievitTester<T> assertRejected(Class<? extends Rejection> token) {
        WireError expected = Rejections.errorFor(token);
        if (!rejected) {
            throw new AssertionError(
                    "expected the call to be rejected with "
                            + expected.reason()
                            + " ("
                            + expected.status()
                            + ") but it returned 200 and rendered:\n"
                            + html
                            + afterCalls());
        }
        boolean reasonMatches =
                expected.reason().equals(rejectionReason) || rejectionStatus == expected.status();
        if (!reasonMatches) {
            throw new AssertionError(
                    "expected the call to be rejected with "
                            + expected.reason()
                            + " ("
                            + expected.status()
                            + ") but it was rejected with "
                            + rejectionReason
                            + " ("
                            + rejectionStatus
                            + ")"
                            + afterCalls());
        }
        return this;
    }

    // --- validation-error assertions -------------------------------------------------------------

    /**
     * Asserts the last successful call returned at least one validation error for {@code field}
     * containing {@code messageFragment} (exact match not required). Use with {@code l:model.live}
     * / {@code l:model.blur} scenarios where the user types and the server responds with per-field
     * errors before a full submit.
     *
     * @param field the {@code @Wire} field name (the key in the {@code errors} effect)
     * @param messageFragment a substring expected in at least one of the field's error messages
     * @return this tester
     */
    public LievitTester<T> assertHasError(String field, String messageFragment) {
        requireNotRejected("assertHasError(\"" + field + "\", …)");
        if (lastErrors == null || !lastErrors.containsKey(field)) {
            throw new AssertionError(
                    "expected validation error for field \""
                            + field
                            + "\" but the last call returned no errors for it"
                            + afterCalls()
                            + " — actual errors: "
                            + render(lastErrors));
        }
        boolean found =
                lastErrors.get(field).stream()
                        .anyMatch(m -> m != null && m.contains(messageFragment));
        if (!found) {
            throw new AssertionError(
                    "expected validation error for field \""
                            + field
                            + "\" containing \""
                            + messageFragment
                            + "\" but messages were: "
                            + lastErrors.get(field)
                            + afterCalls());
        }
        return this;
    }

    /**
     * Asserts the last successful call returned no validation errors at all (all fields passed).
     *
     * @return this tester
     */
    public LievitTester<T> assertNoErrors() {
        requireNotRejected("assertNoErrors()");
        if (lastErrors != null && !lastErrors.isEmpty()) {
            throw new AssertionError(
                    "expected no validation errors but the last call returned: "
                            + render(lastErrors)
                            + afterCalls());
        }
        return this;
    }

    /**
     * Asserts the last successful call returned no validation error for the given {@code field}
     * specifically (other fields may still have errors).
     *
     * @param field the {@code @Wire} field name expected to have no errors
     * @return this tester
     */
    public LievitTester<T> assertNoErrors(String field) {
        requireNotRejected("assertNoErrors(\"" + field + "\")");
        if (lastErrors != null && lastErrors.containsKey(field)) {
            throw new AssertionError(
                    "expected no validation error for field \""
                            + field
                            + "\" but the last call returned: "
                            + lastErrors.get(field)
                            + afterCalls());
        }
        return this;
    }

    // --- domain test-DX: form helpers (Filament TestsForms, issue #367) --------------------------

    /**
     * Fills several form fields at once by staging a client model-update per entry (the Filament
     * {@code fillForm}). The values ride with the next {@link #call(String)}, exactly as a user
     * typing into the form then submitting would carry them.
     *
     * @param values field name to value
     * @return this tester
     */
    public LievitTester<T> fillForm(Map<String, Object> values) {
        values.forEach(this::model);
        return this;
    }

    /**
     * Asserts the live form state equals the given values, reading each field back from the signed
     * snapshot (the Filament {@code assertFormSet}).
     *
     * @param values field name to expected value
     * @return this tester
     */
    public LievitTester<T> assertFormSet(Map<String, Object> values) {
        values.forEach(this::assertWire);
        return this;
    }

    /**
     * Asserts the last call returned a validation error for each of the given fields (the Filament
     * {@code assertHasFormErrors}). Only field presence is checked, not the message.
     *
     * @param fields the field names expected to have at least one error
     * @return this tester
     */
    public LievitTester<T> assertHasFormErrors(List<String> fields) {
        requireNotRejected("assertHasFormErrors(" + fields + ")");
        for (String field : fields) {
            if (lastErrors == null || !lastErrors.containsKey(field)) {
                throw new AssertionError(
                        "expected a form error for field \"" + field + "\" but the last call had none"
                                + afterCalls() + " — actual errors: " + render(lastErrors));
            }
        }
        return this;
    }

    /**
     * Asserts the last call returned no validation errors on any field (the Filament
     * {@code assertHasNoFormErrors}).
     *
     * @return this tester
     */
    public LievitTester<T> assertHasNoFormErrors() {
        return assertNoErrors();
    }

    /**
     * Asserts a form field is present in the rendered form (the Filament
     * {@code assertFormFieldExists}). A field is "present" when its {@code @Wire}-bound name appears
     * in the rendered HTML's binding markup.
     *
     * @param field the field name
     * @return this tester
     */
    public LievitTester<T> assertFormFieldExists(String field) {
        requireNotRejected("assertFormFieldExists(\"" + field + "\")");
        if (!htmlBindsField(field)) {
            throw new AssertionError(
                    "expected the form to contain a field \"" + field + "\" but it was not rendered"
                            + afterCalls() + " — actual HTML:\n" + html);
        }
        return this;
    }

    /**
     * Asserts a form field is currently hidden (not rendered) — typically after a reactive change
     * that should hide it (the Filament {@code assertFormFieldHidden}).
     *
     * @param field the field name
     * @return this tester
     */
    public LievitTester<T> assertFormFieldHidden(String field) {
        requireNotRejected("assertFormFieldHidden(\"" + field + "\")");
        if (htmlBindsField(field)) {
            throw new AssertionError(
                    "expected the form field \"" + field + "\" to be hidden but it was rendered"
                            + afterCalls() + " — actual HTML:\n" + html);
        }
        return this;
    }

    /**
     * Asserts a form field is currently visible (rendered) — the inverse of
     * {@link #assertFormFieldHidden}.
     *
     * @param field the field name
     * @return this tester
     */
    public LievitTester<T> assertFormFieldVisible(String field) {
        return assertFormFieldExists(field);
    }

    // --- domain test-DX: table helpers (Filament TestsRecords/Columns, issue #369) ---------------

    /**
     * Loads/refreshes the table by re-rendering the component (the Filament {@code loadTable}). No-op
     * over the wire other than reading the current HTML; reads clearly at the head of a table chain.
     *
     * @return this tester
     */
    public LievitTester<T> loadTable() {
        requireNotRejected("loadTable()");
        return this;
    }

    /**
     * Asserts every given record is visible in the rendered table (the Filament
     * {@code assertCanSeeTableRecords}). Each record's string form must appear in the HTML.
     *
     * @param records the records expected to be visible
     * @return this tester
     */
    public LievitTester<T> assertCanSeeTableRecords(List<?> records) {
        requireNotRejected("assertCanSeeTableRecords(...)");
        for (Object record : records) {
            String token = String.valueOf(record);
            if (!html.contains(token)) {
                throw new AssertionError(
                        "expected the table to show record \"" + token + "\" but it did not"
                                + afterCalls() + " — actual HTML:\n" + html);
            }
        }
        return this;
    }

    /**
     * Asserts none of the given records is visible in the rendered table (the Filament
     * {@code assertCanNotSeeTableRecords}).
     *
     * @param records the records expected to be absent
     * @return this tester
     */
    public LievitTester<T> assertCanNotSeeTableRecords(List<?> records) {
        requireNotRejected("assertCanNotSeeTableRecords(...)");
        for (Object record : records) {
            String token = String.valueOf(record);
            if (html.contains(token)) {
                throw new AssertionError(
                        "expected the table NOT to show record \"" + token + "\" but it did"
                                + afterCalls() + " — actual HTML:\n" + html);
            }
        }
        return this;
    }

    /**
     * Asserts the table shows exactly {@code count} records, counted by occurrences of a per-row
     * marker the table template emits (the Filament {@code assertCountTableRecords}). The marker is
     * the {@code data-lievit-row} attribute the kit's list template stamps on each row.
     *
     * @param count the expected row count
     * @return this tester
     */
    public LievitTester<T> assertCountTableRecords(int count) {
        requireNotRejected("assertCountTableRecords(" + count + ")");
        int actual = countOccurrences(html, "data-lievit-row");
        if (actual != count) {
            throw new AssertionError(
                    "expected the table to show " + count + " records but it showed " + actual
                            + afterCalls());
        }
        return this;
    }

    /**
     * Searches the table by staging the search term and calling the table's search action (the
     * Filament {@code searchTable}). Assumes the component binds a {@code search} field and exposes a
     * {@code search} action; an adopter table that names these differently uses {@link #model} +
     * {@link #call} directly.
     *
     * @param term the search term
     * @return this tester
     */
    public LievitTester<T> searchTable(String term) {
        return model("search", term).call("search");
    }

    /**
     * Sorts the table by staging the sort column + direction and calling the {@code sort} action
     * (the Filament {@code sortTable}).
     *
     * @param column the column key
     * @param direction {@code "asc"} or {@code "desc"}
     * @return this tester
     */
    public LievitTester<T> sortTable(String column, String direction) {
        return model("sortColumn", column).model("sortDirection", direction).call("sort");
    }

    /**
     * Applies a table filter by staging its values and calling the {@code filter} action (the
     * Filament {@code filterTable}).
     *
     * @param filter the filter name
     * @param values the filter values
     * @return this tester
     */
    public LievitTester<T> filterTable(String filter, Map<String, Object> values) {
        model("activeFilter", filter);
        values.forEach((k, v) -> model("filter." + k, v));
        return call("filter");
    }

    // --- domain test-DX: action + bulk-action helpers (Filament TestsActions, issue #371) --------

    /**
     * Calls a page action by name with data (the Filament {@code callAction}): stages the data and
     * invokes the action over the wire.
     *
     * @param name the action name (a {@code @LievitAction} the component exposes)
     * @param data the action's form/argument data
     * @return this tester
     */
    public LievitTester<T> callAction(String name, Map<String, Object> data) {
        data.forEach(this::model);
        return call(name);
    }

    /**
     * Calls a page action by name with no data.
     *
     * @param name the action name
     * @return this tester
     */
    public LievitTester<T> callAction(String name) {
        return call(name);
    }

    /**
     * Calls a row-scoped table action against a specific record (the Filament
     * {@code callTableAction}): stages the record id and the action data, then invokes the action.
     *
     * @param name the action name
     * @param recordId the id of the row the action targets
     * @param data the action data
     * @return this tester
     */
    public LievitTester<T> callTableAction(String name, Object recordId, Map<String, Object> data) {
        model("recordId", recordId);
        data.forEach(this::model);
        return call(name);
    }

    /**
     * Calls a bulk action over a selection of record ids (the Filament {@code callTableBulkAction}):
     * stages the selection then invokes the bulk action.
     *
     * @param name the bulk action name
     * @param recordIds the selected record ids
     * @return this tester
     */
    public LievitTester<T> callTableBulkAction(String name, List<?> recordIds) {
        model("selectedRecords", recordIds);
        return call(name);
    }

    /**
     * Stages a table-row selection without running an action (the Filament
     * {@code selectTableRecords}).
     *
     * @param recordIds the selected record ids
     * @return this tester
     */
    public LievitTester<T> selectTableRecords(List<?> recordIds) {
        return model("selectedRecords", recordIds);
    }

    // --- domain test-DX: notification helpers (Filament TestsNotifications, issue #375) ----------

    /**
     * Asserts a flash notification with the given title/message was sent on the last call (the
     * Filament {@code assertNotified}). Reads the {@code lievit-admin-notify} event dispatched onto
     * the {@code Lievit-Effects} channel.
     *
     * @param titleFragment a substring expected in the notification's message
     * @return this tester
     */
    public LievitTester<T> assertNotified(String titleFragment) {
        requireNotRejected("assertNotified(\"" + titleFragment + "\")");
        List<String> messages = notificationMessages();
        boolean found = messages.stream().anyMatch(m -> m != null && m.contains(titleFragment));
        if (!found) {
            throw new AssertionError(
                    "expected a notification containing \"" + titleFragment + "\" but the last call"
                            + " sent: " + messages + afterCalls());
        }
        return this;
    }

    /**
     * Asserts no notification was sent on the last call (the Filament {@code assertNotNotified}) —
     * for example an action that halted before notifying.
     *
     * @return this tester
     */
    public LievitTester<T> assertNotNotified() {
        requireNotRejected("assertNotNotified()");
        List<String> messages = notificationMessages();
        if (!messages.isEmpty()) {
            throw new AssertionError(
                    "expected no notification but the last call sent: " + messages + afterCalls());
        }
        return this;
    }

    // --- domain test-DX: schema + wizard helpers (Filament TestsSchemas, issue #373) -------------

    /**
     * Asserts a schema component is rendered (the Filament {@code assertSchemaComponentExists}).
     * Reuses the form-field presence check on the component's bound name.
     *
     * @param component the component (field/section) name
     * @return this tester
     */
    public LievitTester<T> assertSchemaComponentExists(String component) {
        return assertFormFieldExists(component);
    }

    /**
     * Asserts a schema component is hidden (the Filament {@code assertSchemaComponentHidden}) — for
     * example a section gated by a conditional-visibility rule.
     *
     * @param component the component name
     * @return this tester
     */
    public LievitTester<T> assertSchemaComponentHidden(String component) {
        return assertFormFieldHidden(component);
    }

    /**
     * Asserts the wizard's current step (the Filament {@code assertWizardCurrentStep}), read from the
     * {@code @Wire currentStep} field.
     *
     * @param step the expected one-based step number
     * @return this tester
     */
    public LievitTester<T> assertWizardCurrentStep(int step) {
        return assertWire("currentStep", step);
    }

    /**
     * Advances the wizard to the next step (the Filament {@code goToNextWizardStep}): invokes the
     * {@code nextStep} action. If the current step's validation fails the action halts and the step
     * does not advance, which the caller asserts with {@link #assertWizardCurrentStep}.
     *
     * @return this tester
     */
    public LievitTester<T> goToNextWizardStep() {
        return call("nextStep");
    }

    /**
     * Goes back to the previous wizard step (the Filament {@code goToPreviousWizardStep}).
     *
     * @return this tester
     */
    public LievitTester<T> goToPreviousWizardStep() {
        return call("previousStep");
    }

    // --- effects assertions (events, redirects; ADR-0030 / ADR-0031) -----------------------------

    /**
     * Asserts the last call queued a {@code dispatch} effect for the named event (Livewire
     * {@code assertDispatched}). Order-independent; the detail is not checked.
     *
     * @param event the event name
     * @return this tester
     */
    public LievitTester<T> assertDispatched(String event) {
        requireNotRejected("assertDispatched(\"" + event + "\")");
        if (!dispatchedNames().contains(event)) {
            throw new AssertionError(
                    "expected a dispatched event '" + event + "', but the last call dispatched "
                            + dispatchedNames());
        }
        return this;
    }

    /**
     * Asserts the last call did NOT dispatch the named event (Livewire {@code assertNotDispatched}).
     *
     * @param event the event name
     * @return this tester
     */
    public LievitTester<T> assertNotDispatched(String event) {
        requireNotRejected("assertNotDispatched(\"" + event + "\")");
        if (dispatchedNames().contains(event)) {
            throw new AssertionError("expected NO dispatched event '" + event + "', but one was queued");
        }
        return this;
    }

    /**
     * Asserts the last call dispatched the event targeted at a component by name (the
     * {@code dispatchTo} routing, Livewire {@code assertDispatchedTo}).
     *
     * @param component the target component name carried in the effect's {@code to} key
     * @param event the event name
     * @return this tester
     */
    public LievitTester<T> assertDispatchedTo(String component, String event) {
        requireNotRejected("assertDispatchedTo(...)");
        if (lastEffects != null) {
            JsonNode dispatch = lastEffects.get("dispatch");
            if (dispatch != null && dispatch.isArray()) {
                for (JsonNode e : dispatch) {
                    JsonNode name = e.get("name");
                    JsonNode to = e.get("to");
                    if (name != null && event.equals(name.asText())
                            && to != null && component.equals(to.asText())) {
                        return this;
                    }
                }
            }
        }
        throw new AssertionError(
                "expected event '" + event + "' dispatched to component '" + component + "'");
    }

    /**
     * Asserts the last call queued a {@code redirect} effect to the given location (Livewire
     * {@code assertRedirect}).
     *
     * @param location the expected redirect URL/path
     * @return this tester
     */
    public LievitTester<T> assertRedirect(String location) {
        requireNotRejected("assertRedirect(\"" + location + "\")");
        String actual = redirectLocation();
        if (actual == null) {
            throw new AssertionError("expected a redirect to '" + location + "', but none was queued");
        }
        if (!location.equals(actual)) {
            throw new AssertionError(
                    "expected a redirect to '" + location + "', but it was '" + actual + "'");
        }
        return this;
    }

    /**
     * Asserts the last call queued no {@code redirect} effect (Livewire {@code assertNoRedirect}).
     *
     * @return this tester
     */
    public LievitTester<T> assertNoRedirect() {
        requireNotRejected("assertNoRedirect()");
        String actual = redirectLocation();
        if (actual != null) {
            throw new AssertionError("expected NO redirect, but one was queued to '" + actual + "'");
        }
        return this;
    }

    /**
     * Asserts the last call queued a {@code download} effect ({@code $this.download}, issue #161)
     * with the given file name, exact (UTF-8) content, and content type (Livewire
     * {@code assertFileDownloaded}). The content is decoded from the base64 the effect carries.
     *
     * @param name the expected file name
     * @param content the expected file content (compared as a UTF-8 string)
     * @param contentType the expected content type
     * @return this tester
     */
    public LievitTester<T> assertFileDownloaded(String name, String content, String contentType) {
        requireNotRejected("assertFileDownloaded(\"" + name + "\")");
        JsonNode download = lastEffects == null ? null : lastEffects.get("download");
        if (download == null || download.isNull()) {
            throw new AssertionError("expected a file download '" + name + "', but none was queued");
        }
        String actualName = downloadText(download, "name");
        if (!name.equals(actualName)) {
            throw new AssertionError(
                    "expected a download named '" + name + "', but it was '" + actualName + "'");
        }
        String actualType = downloadText(download, "type");
        if (!contentType.equals(actualType)) {
            throw new AssertionError(
                    "expected download content type '" + contentType + "', but it was '" + actualType + "'");
        }
        String base64 = downloadText(download, "content");
        String actualContent =
                base64 == null
                        ? ""
                        : new String(
                                java.util.Base64.getDecoder().decode(base64),
                                java.nio.charset.StandardCharsets.UTF_8);
        if (!content.equals(actualContent)) {
            throw new AssertionError(
                    "expected download content '" + content + "', but it was '" + actualContent + "'");
        }
        return this;
    }

    /**
     * Asserts the last call queued NO {@code download} effect (issue #161): the action returned
     * nothing downloadable, so the page simply re-rendered.
     *
     * @return this tester
     */
    public LievitTester<T> assertNoFileDownloaded() {
        requireNotRejected("assertNoFileDownloaded()");
        JsonNode download = lastEffects == null ? null : lastEffects.get("download");
        if (download != null && !download.isNull()) {
            throw new AssertionError(
                    "expected NO file download, but one was queued: '" + downloadText(download, "name") + "'");
        }
        return this;
    }

    private static @Nullable String downloadText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private List<String> dispatchedNames() {
        List<String> names = new ArrayList<>();
        if (lastEffects == null) {
            return names;
        }
        JsonNode dispatch = lastEffects.get("dispatch");
        if (dispatch != null && dispatch.isArray()) {
            for (JsonNode e : dispatch) {
                JsonNode name = e.get("name");
                if (name != null) {
                    names.add(name.asText());
                }
            }
        }
        return names;
    }

    private @Nullable String redirectLocation() {
        if (lastEffects == null) {
            return null;
        }
        JsonNode redirect = lastEffects.get("redirect");
        return redirect == null || redirect.isNull() ? null : redirect.asText();
    }

    // --- internals -------------------------------------------------------------------------------

    /** @return whether the rendered HTML binds the given field name (a {@code l:model} binding) */
    private boolean htmlBindsField(String field) {
        return html.contains("l:model=\"" + field + "\"")
                || html.contains("l:model.live=\"" + field + "\"")
                || html.contains("l:model.blur=\"" + field + "\"")
                || html.contains("name=\"" + field + "\"")
                || html.contains("wire:model=\"" + field + "\"");
    }

    /** @return the messages of every {@code lievit-admin-notify} dispatch on the last call */
    private List<String> notificationMessages() {
        List<String> messages = new ArrayList<>();
        if (lastEffects == null) {
            return messages;
        }
        JsonNode dispatch = lastEffects.get("dispatch");
        if (dispatch == null || !dispatch.isArray()) {
            return messages;
        }
        for (JsonNode event : dispatch) {
            JsonNode name = event.get("name");
            if (name != null && "lievit-admin-notify".equals(name.asText())) {
                JsonNode detail = event.get("detail");
                JsonNode message = detail == null ? null : detail.get("message");
                if (message != null) {
                    messages.add(message.asText());
                }
            }
        }
        return messages;
    }

    private static int countOccurrences(String haystack, String needle) {
        int count = 0;
        int at = 0;
        while ((at = haystack.indexOf(needle, at)) >= 0) {
            count++;
            at += needle.length();
        }
        return count;
    }

    private Map<String, Object> wireState() {
        Snapshot decoded = codec.verify(snapshot, Instant.now());
        return decoded.wire();
    }

    @SuppressWarnings("unchecked")
    private T rehydratedInstance() {
        ComponentMetadata metadata = registry.metadata(className);
        Object instance = registry.freshInstance(className);
        // Replay the live snapshot state onto a fresh instance through the real dispatcher (no
        // updates, no calls): the instance reflects exactly what the wire carries.
        dispatcher.call(metadata, instance, wireState(), Map.of(), List.of());
        return (T) instance;
    }

    private static Object navigate(Map<String, Object> root, String path) {
        Object current = root;
        for (String segment : path.split("\\.")) {
            if (segment.equals("size")) {
                current = sizeOf(current);
                continue;
            }
            if (current instanceof Map<?, ?> map) {
                current = map.get(segment);
            } else {
                throw new AssertionError(
                        "cannot navigate into '" + segment + "' of " + render(current)
                                + ": not a map");
            }
        }
        return current;
    }

    private static int sizeOf(Object value) {
        if (value instanceof Collection<?> c) {
            return c.size();
        }
        if (value instanceof Map<?, ?> m) {
            return m.size();
        }
        if (value instanceof Object[] a) {
            return a.length;
        }
        if (value instanceof CharSequence s) {
            return s.length();
        }
        throw new AssertionError(".size is not defined for " + render(value));
    }

    private static boolean valuesEqual(Object expected, Object actual) {
        if (expected instanceof Number e && actual instanceof Number a) {
            return e.doubleValue() == a.doubleValue();
        }
        if (expected == null) {
            return actual == null;
        }
        return expected.equals(actual);
    }

    private String forge(String signed) {
        String[] parts = signed.split("\\.");
        if (parts.length != 3) {
            // Not a JWT shape: scramble the whole string so the HMAC cannot verify.
            return signed + "tampered";
        }
        char[] payload = parts[1].toCharArray();
        payload[0] = payload[0] == 'a' ? 'b' : 'a';
        return parts[0] + "." + new String(payload) + "." + parts[2];
    }

    private void requireNotRejected(String assertion) {
        if (rejected) {
            throw new AssertionError(
                    assertion
                            + " cannot run: the last call was rejected with "
                            + rejectionReason
                            + " ("
                            + rejectionStatus
                            + "). Use assertRejected(...) for a call you expect to fail.");
        }
    }

    /** Parses the {@code errors} key from the {@code Lievit-Effects} JSON header, or null. */
    @SuppressWarnings("unchecked")
    private @Nullable Map<String, List<String>> parseErrors(@Nullable String effectsHeader) {
        if (effectsHeader == null || effectsHeader.isBlank()) {
            return null;
        }
        try {
            JsonNode root = json.readTree(effectsHeader);
            JsonNode errorsNode = root.get("errors");
            if (errorsNode == null || errorsNode.isNull()) {
                return null;
            }
            return json.convertValue(
                    errorsNode, new TypeReference<Map<String, List<String>>>() {});
        } catch (Exception e) {
            // Parsing failure in a test helper: surface as an assertion error so the test fails
            // with a clear message rather than a silent null.
            throw new AssertionError(
                    "could not parse Lievit-Effects header: " + effectsHeader, e);
        }
    }

    /** Parses the whole {@code Lievit-Effects} JSON header into a tree, or null if absent/blank. */
    private @Nullable JsonNode parseEffects(@Nullable String effectsHeader) {
        if (effectsHeader == null || effectsHeader.isBlank()) {
            return null;
        }
        try {
            return json.readTree(effectsHeader);
        } catch (Exception e) {
            throw new AssertionError("could not parse Lievit-Effects header: " + effectsHeader, e);
        }
    }

    private static String bodyOf(MvcResult result) {
        try {
            return result.getResponse().getContentAsString();
        } catch (Exception e) {
            throw new IllegalStateException("could not read the response body", e);
        }
    }

    private String afterCalls() {
        return callHistory.isEmpty() ? " (no calls yet, after mount)" : " after calls " + callHistory;
    }

    private static String render(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof CharSequence) {
            return "\"" + value + "\"";
        }
        return value.toString();
    }
}

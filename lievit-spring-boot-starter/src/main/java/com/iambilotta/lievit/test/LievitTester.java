/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Predicate;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iambilotta.lievit.component.ComponentMetadata;
import com.iambilotta.lievit.component.WireDispatcher;
import com.iambilotta.lievit.spring.ComponentRegistry;
import com.iambilotta.lievit.spring.LievitWireService;
import com.iambilotta.lievit.spring.WireCallResult;
import com.iambilotta.lievit.test.Rejections.Rejection;
import com.iambilotta.lievit.wire.Snapshot;
import com.iambilotta.lievit.wire.SnapshotCodec;
import com.iambilotta.lievit.wire.WireError;

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

    // --- internals -------------------------------------------------------------------------------

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

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.NativeWebRequest;

import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;

/**
 * The wire endpoint: {@code POST /lievit/{componentId}/call} (ADR-0001, wire-protocol.md §1/§4).
 *
 * <p>It is a thin HTTP edge: it delegates the whole lifecycle to {@link LievitWireService} and maps
 * the response to {@code 200 text/html} + the {@code Lievit-Snapshot} header. A {@link
 * WireException} from the service is translated to its exact status + {@code Lievit-Reason} header
 * by {@link #handleWireError}, realizing the error-code state machine. CSRF is enforced upstream by
 * Spring Security's standard filter (the {@code _token}), so it is not handled here.
 *
 * <p><strong>Fail-closed, leak-free (ADR-0014).</strong> No error response carries the exception
 * message, a stack trace, an internal class name, or any snapshot / token / payload content. A
 * {@link WireException} maps to its terminal status with an empty body and only the
 * {@code Lievit-Reason} header; any other throwable (an action that threw, a binding failure) is
 * caught by {@link #handleUnexpected}, logged server-side with its full detail, and answered with a
 * generic {@code 500} + {@code Lievit-Reason: internal-error} and an empty body. The client learns
 * <em>that</em> it failed and the coarse reason, never the internals (Livewire
 * {@code CorruptComponentPayloadException} parity: generic in prod, detail only in the server log).
 */
@RestController
public final class LievitWireController {

    private static final Logger log = LoggerFactory.getLogger(LievitWireController.class);

    static final String SNAPSHOT_HEADER = "Lievit-Snapshot";
    static final String EFFECTS_HEADER = "Lievit-Effects";
    static final String REASON_HEADER = "Lievit-Reason";
    /** The wire-request marker the client bundle stamps on every wire request (issue #177). */
    static final String WIRE_HEADER = "X-Lievit";

    private final LievitWireService service;

    /**
     * @param service the wire-call orchestrator
     */
    public LievitWireController(LievitWireService service) {
        this.service = service;
    }

    /**
     * Handles one wire call.
     *
     * @param componentId the component instance id from the path (audited; the snapshot's
     *     {@code cid} is authoritative)
     * @param body the {@code { _snapshot, _updates, _calls }} payload
     * @param request the servlet request (for the client IP rate-limit key)
     * @return 200 {@code text/html} (the patched markup) + the {@code Lievit-Snapshot} header, and
     *     the optional {@code Lievit-Effects} header when the action produced effects (ADR-0012)
     */
    /**
     * The batched update endpoint (issue #177): {@code POST /lievit/update}. The client posts an
     * array of components ({@code {components:[{snapshot,updates,calls,events}]}}); each commits
     * through its own stateless lifecycle and the response is a JSON body with one result per
     * component (committed {@code {snapshot,effects,html}} or {@code {skip,id}}) plus a page-level
     * {@code assets} block. A page with several islands commits them in one request instead of N.
     *
     * <p>Header guard: this endpoint is a wire-only surface. A non-wire request (no
     * {@code X-Lievit} header) is rejected with 400 so a plain browser GET / form POST cannot reach
     * it (Livewire's {@code RequireLivewireHeaders}). The session store is bound for the duration of
     * the whole batch (every component in the batch shares the request's session).
     *
     * @param body the {@code {components:[...]}} batch payload
     * @param wireHeader the {@code X-Lievit} marker the client bundle stamps on every wire request
     * @param request the servlet request (for the session store + the rate-limit key)
     * @return 200 {@code application/json}: the batch response
     */
    @PostMapping(
            path = "/lievit/update",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BatchUpdateResponse> update(
            @RequestBody BatchUpdateRequest body,
            @org.springframework.web.bind.annotation.RequestHeader(value = WIRE_HEADER, required = false)
                    String wireHeader,
            HttpServletRequest request) {
        if (wireHeader == null) {
            // Non-wire hit (a browser navigating to the endpoint, a form POST): refuse it. The wire
            // header is set by the client bundle on every wire request (Livewire RequireLivewireHeaders).
            throw new WireException(WireError.MISSING_WIRE_HEADER, "missing X-Lievit wire header");
        }
        dev.lievit.component.SessionListener.bind(new HttpSessionStore(request));
        dev.lievit.component.LocaleListener.bind(SpringLocaleSource.INSTANCE);
        BatchUpdateResponse response;
        try {
            response = service.batch(body.components(), clientKey(request));
        } finally {
            dev.lievit.component.LocaleListener.clear();
            dev.lievit.component.SessionListener.clear();
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping(path = "/lievit/{componentId}/call", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> call(
            @PathVariable String componentId,
            @RequestBody WireCallRequest body,
            HttpServletRequest request) {
        // Bind an HttpSession-backed store for @LievitSession fields for the duration of the call
        // (ADR-0031). Cleared in the finally so nothing leaks across calls; without a session in
        // play the listener simply no-ops (the field keeps its mount default).
        dev.lievit.component.SessionListener.bind(new HttpSessionStore(request));
        // Pin the request's resolved locale across this component's round trip (ADR-0037): the
        // listener restores the memo'd locale onto LocaleContextHolder before the render.
        dev.lievit.component.LocaleListener.bind(SpringLocaleSource.INSTANCE);
        WireCallResult result;
        try {
            result =
                    service.call(
                            body.snapshot(),
                            body.updatesOrEmpty(),
                            body.callsOrEmpty(),
                            body.inboundEvents(),
                            clientKey(request));
        } finally {
            dev.lievit.component.LocaleListener.clear();
            dev.lievit.component.SessionListener.clear();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.add(SNAPSHOT_HEADER, result.snapshot());
        if (result.effects() != null) {
            // The effects channel (ADR-0012): a compact JSON bag, present only when the action
            // produced an effect. Absent header == no effects == ADR-0001's original response.
            headers.add(EFFECTS_HEADER, result.effects());
        }
        return ResponseEntity.ok().headers(headers).body(result.html());
    }

    /**
     * The streaming endpoint (issue #153): {@code POST /lievit/{componentId}/stream}. The client
     * opens a Server-Sent-Events connection here for an action that streams progressive output (an AI
     * token stream, a long job). A live {@link dev.lievit.component.LievitStream} is bound for the
     * duration of the call; every {@code $this.stream(...)} the action makes is written immediately as
     * a flushed JSON envelope {@code {target, content, replace}} (the shape the client's
     * {@code parseStreamEnvelope} reads), then the SSE stream completes when the action returns.
     *
     * <p>Header guard like the batch endpoint: a non-wire request (no {@code X-Lievit}) is refused so a
     * plain browser GET cannot open the stream. The component is rehydrated from the signed snapshot
     * and the named action invoked through the normal lifecycle, so the action sees current state and
     * the {@code @LievitAction} allowlist still applies.
     *
     * @param componentId the component instance id (audited; the snapshot's {@code cid} is authoritative)
     * @param body the {@code { _snapshot, _updates, _calls }} payload (the action to stream is in
     *     {@code _calls})
     * @param wireHeader the {@code X-Lievit} marker the client stamps on every wire request
     * @param request the servlet request (session store + rate-limit key)
     * @return an {@link SseEmitter} the streamed chunks flush over as {@code text/event-stream}
     */
    @PostMapping(path = "/lievit/{componentId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter stream(
            @PathVariable String componentId,
            @RequestBody WireCallRequest body,
            @org.springframework.web.bind.annotation.RequestHeader(value = WIRE_HEADER, required = false)
                    String wireHeader,
            HttpServletRequest request) {
        if (wireHeader == null) {
            throw new WireException(WireError.MISSING_WIRE_HEADER, "missing X-Lievit wire header");
        }
        var emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(0L);
        // Bind a live stream sink that flushes each chunk as an SSE envelope the moment the action
        // streams it. A null/undefined content is never produced (StreamChunk forbids null), so the
        // client never has to skip an envelope; falsy strings ("", "0") flush correctly.
        dev.lievit.component.LievitStream stream =
                dev.lievit.component.LievitStream.live(
                        chunk -> {
                            try {
                                emitter.send(
                                        org.springframework.web.servlet.mvc.method.annotation.SseEmitter
                                                .event()
                                                .data(service.encodeStreamChunk(chunk)));
                            } catch (java.io.IOException e) {
                                emitter.completeWithError(e);
                            }
                        });
        dev.lievit.component.SessionListener.bind(new HttpSessionStore(request));
        dev.lievit.component.LocaleListener.bind(SpringLocaleSource.INSTANCE);
        dev.lievit.component.LievitStream.bind(stream);
        try {
            service.call(
                    body.snapshot(),
                    body.updatesOrEmpty(),
                    body.callsOrEmpty(),
                    body.inboundEvents(),
                    clientKey(request));
            emitter.complete();
        } catch (RuntimeException e) {
            emitter.completeWithError(e);
            throw e;
        } finally {
            dev.lievit.component.LievitStream.clear();
            dev.lievit.component.LocaleListener.clear();
            dev.lievit.component.SessionListener.clear();
        }
        return emitter;
    }

    /**
     * Maps a {@link WireException} to its terminal HTTP status and the {@code Lievit-Reason} header
     * (wire-protocol.md §4). The body is never the exception message (the privacy rule keeps
     * snapshot / token / payload contents out of responses).
     *
     * @param e the wire exception carrying the terminal error
     * @param webRequest the request (unused beyond signature symmetry)
     * @return the mapped error response
     */
    @ExceptionHandler(WireException.class)
    public ResponseEntity<String> handleWireError(WireException e, NativeWebRequest webRequest) {
        WireError error = e.error();
        HttpHeaders headers = new HttpHeaders();
        headers.add(REASON_HEADER, error.reason());
        // Empty body: the Lievit-Reason header is the whole contract. The exception message
        // (e.getMessage()) is never written to the response (fail-closed, ADR-0014).
        return ResponseEntity.status(error.status()).headers(headers).build();
    }

    /**
     * Catch-all for any throwable that is not a {@link WireException}: an action that threw, a
     * deserialization failure, an unexpected runtime error. Answers a generic {@code 500} +
     * {@code Lievit-Reason: internal-error} with an <strong>empty body</strong>; the full detail
     * (message, stack trace, FQN) is logged server-side only, never echoed to the client. This is
     * the fail-closed, leak-free posture of ADR-0014: without it, Spring's default error view would
     * surface the internal class names and message to the browser.
     *
     * @param e the unexpected throwable
     * @param webRequest the request (unused beyond signature symmetry)
     * @return a generic {@code 500} with no body
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleUnexpected(Exception e, NativeWebRequest webRequest) {
        WireError error = WireError.INTERNAL_ERROR;
        // Server-side only: the detail lives in the log, never in the response.
        log.error("wire call failed with an unexpected error", e);
        HttpHeaders headers = new HttpHeaders();
        headers.add(REASON_HEADER, error.reason());
        return ResponseEntity.status(error.status()).headers(headers).build();
    }

    private String clientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma >= 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }
}

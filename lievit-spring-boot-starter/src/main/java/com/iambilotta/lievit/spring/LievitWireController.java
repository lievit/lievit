/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

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

import com.iambilotta.lievit.wire.WireError;
import com.iambilotta.lievit.wire.WireException;

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
    @PostMapping(path = "/lievit/{componentId}/call", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> call(
            @PathVariable String componentId,
            @RequestBody WireCallRequest body,
            HttpServletRequest request) {
        WireCallResult result =
                service.call(
                        body.snapshot(),
                        body.updatesOrEmpty(),
                        body.callsOrEmpty(),
                        clientKey(request));

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

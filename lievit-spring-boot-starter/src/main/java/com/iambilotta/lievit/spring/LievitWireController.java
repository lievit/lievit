/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

import jakarta.servlet.http.HttpServletRequest;

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
 */
@RestController
public final class LievitWireController {

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

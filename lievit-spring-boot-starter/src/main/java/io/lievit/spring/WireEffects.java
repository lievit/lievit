/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.fasterxml.jackson.annotation.JsonInclude;

import io.lievit.component.DispatchedEvent;
import io.lievit.component.DownloadEffect;
import io.lievit.component.LievitEffects;

/**
 * The wire-serializable form of the effects channel: the JSON object carried in the
 * {@code Lievit-Effects} response header (ADR-0012). Built from the core {@link LievitEffects} sink
 * by the web layer; only the non-null keys are emitted, so a plain action serializes to an empty
 * object (and the web layer then omits the header entirely).
 *
 * <p>The {@code errors} key is the real-time validation effect: a {@code {field: [message, ...]}}
 * map set by the dispatcher when {@link io.lievit.component.FieldValidator} returns
 * constraint violations. The client renders per-field error messages from it. Only constraint
 * messages are surfaced; no internal class names or payload content ever appear (ADR-0014).
 *
 * @param redirect the navigation the action requested, or {@code null}
 * @param dispatch the events the action queued (omitted when empty)
 * @param returns the action's return value, or {@code null}
 * @param errors per-field validation errors ({@code {fieldName: ["message", ...]}}) set when the
 *     {@link io.lievit.component.FieldValidator} found constraint violations; absent
 *     when validation passed or no validator is configured
 * @param validatedFields the field names a live {@code validateOnly} update revalidated (ADR-0038),
 *     so the client merges the errors into its bag (clearing exactly these fields, keeping the
 *     rest); {@code null} on a full {@code validate}/submit (the client then full-replaces)
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WireEffects(
        @Nullable String redirect,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Event> dispatch,
        @Nullable Object returns,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) @Nullable Map<String, List<String>> errors,
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable List<String> validatedFields,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<String> islands,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Js> js,
        @Nullable String release,
        @Nullable Transition transition,
        @Nullable Download download) {

    /**
     * One queued browser event, the serialized {@link DispatchedEvent}. The {@code to} / {@code self}
     * keys carry the routing target so the client runtime delivers the event to the right listeners
     * (ADR-0030): {@code self=true} for {@code dispatchSelf}, {@code to="component-name"} for
     * {@code dispatchTo}; both absent for a global {@code dispatch}.
     *
     * @param name the event name (the {@code CustomEvent} type)
     * @param detail the event payload, or {@code null} for a bare signal
     * @param to the target component name for {@code dispatchTo}, else {@code null}
     * @param self {@code true} for {@code dispatchSelf}, else {@code null} (omitted)
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Event(
            String name,
            @Nullable Map<String, Object> detail,
            @Nullable String to,
            @Nullable Boolean self) {}

    /**
     * One serialized CSP-safe {@code $js} call (ADR-0024 #131): the registered handler name + args.
     *
     * @param name the handler name the client looks up in {@code runtime.js}
     * @param args the call arguments (JSON-shaped)
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Js(String name, @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Object> args) {}

    /**
     * The serialized {@code transition} control ({@code @LievitTransition} / {@code l:transition},
     * #113, ADR-0034): the client transition feature reads it for this update's morph. {@code skip}
     * is omitted when false; {@code duration} / {@code name} are omitted when null. The shape matches
     * the client's {@code TransitionEffect} ({@code {skip?, duration?, name?}}).
     *
     * @param skip {@code true} to suppress the transition for this update, else {@code null} (omitted)
     * @param duration the override duration in ms, or {@code null} (omitted)
     * @param name a named transition the client recognises, or {@code null} (omitted)
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Transition(
            @Nullable Boolean skip, @Nullable Integer duration, @Nullable String name) {}

    /**
     * The serialized {@code download} effect ({@code $this.download}, issue #161): the file name, its
     * base64 content, and the content type. The client decodes {@code content} into a Blob stamped
     * with {@code type} and triggers a browser download named {@code name}; the HTML body still
     * morphs. The reserved {@code download} key of wire-protocol.md §5b.
     *
     * @param name the download file name
     * @param content the file content, base64-encoded
     * @param type the MIME content type
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Download(String name, String content, String type) {}

    /**
     * Projects the core effects sink into its wire form.
     *
     * @param effects the per-call effects sink
     * @return the serializable effects, or {@code null} if the sink produced nothing (the header is
     *     then omitted, keeping a no-effects call byte-for-byte compatible with ADR-0001)
     */
    public static @Nullable WireEffects from(LievitEffects effects) {
        if (effects.isEmpty()) {
            return null;
        }
        List<Event> events =
                effects.dispatched().stream()
                        .map(WireEffects::toEvent)
                        .toList();
        List<Js> jsCalls =
                effects.jsCalls().stream().map(c -> new Js(c.name(), c.args())).toList();
        return new WireEffects(
                effects.redirect(),
                events,
                effects.returnValue(),
                effects.validationErrors(),
                effects.validatedFields(),
                effects.islands(),
                jsCalls,
                effects.release(),
                toTransition(effects.transition()),
                toDownload(effects.download()));
    }

    private static @Nullable Download toDownload(@Nullable DownloadEffect d) {
        if (d == null) {
            return null;
        }
        return new Download(d.name(), d.base64(), d.contentType());
    }

    private static @Nullable Transition toTransition(
            io.lievit.component.@Nullable TransitionEffect t) {
        if (t == null) {
            return null;
        }
        // Emit skip only when true (NON_NULL drops it otherwise), so a plain duration/name control
        // does not carry a spurious skip:false the client would have to ignore.
        return new Transition(t.skip() ? Boolean.TRUE : null, t.duration(), t.name());
    }

    private static Event toEvent(DispatchedEvent d) {
        return new Event(
                d.name(),
                d.detail(),
                d.target() == DispatchedEvent.Target.TO_COMPONENT ? d.targetName() : null,
                d.target() == DispatchedEvent.Target.SELF ? Boolean.TRUE : null);
    }
}

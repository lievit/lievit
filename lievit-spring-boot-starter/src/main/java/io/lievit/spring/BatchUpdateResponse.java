/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * The batched update response (issue #177, Livewire {@code HandleRequests::handleUpdate} return
 * shape): one entry per requested component plus a page-level {@code assets} block. Each component
 * entry is either a committed result ({@code {snapshot, effects, html}}) or a skip marker
 * ({@code {skip:true, id}}) for a reactive child whose props did not change (no lifecycle ran).
 *
 * <p>Unlike the per-component endpoint (which rides the snapshot + effects on response headers), the
 * batch endpoint returns a JSON {@code application/json} body, because N components' snapshots and
 * effects cannot all fit in one header set. The effects here are the same {@link WireEffects} bag
 * the header carries for the single endpoint.
 *
 * @param components the per-component results, index-aligned with the request's {@code components[]}
 * @param assets page-level late assets (runtime script handles, per-component asset bundles); empty
 *     today, reserved for the asset-pipeline work (issue #171)
 */
public record BatchUpdateResponse(
        List<ComponentResult> components,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, Object> assets) {

    /**
     * One component's result: a committed result or a skip marker. {@code skip} is {@code null}
     * (omitted) on a committed result; on a skip marker only {@code skip} + {@code id} are present.
     *
     * @param id the component instance id (always present, so the client can match the entry to its
     *     DOM component)
     * @param snapshot the next signed snapshot, or {@code null} on a skip
     * @param html the rendered HTML patch, or {@code null} on a skip / renderless
     * @param effects the effects bag, or {@code null} when none / on a skip
     * @param skip {@code true} when this component was skipped (unchanged reactive child), else
     *     {@code null} (omitted)
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ComponentResult(
            String id,
            @Nullable String snapshot,
            @Nullable String html,
            @Nullable WireEffects effects,
            @Nullable Boolean skip) {

        /**
         * A committed component result.
         *
         * @param id the component id
         * @param snapshot the next signed snapshot
         * @param html the rendered HTML
         * @param effects the effects bag, or {@code null}
         * @return a committed result (skip omitted)
         */
        public static ComponentResult committed(
                String id, String snapshot, String html, @Nullable WireEffects effects) {
            return new ComponentResult(id, snapshot, html, effects, null);
        }

        /**
         * A skip marker for an unchanged reactive child.
         *
         * @param id the component id
         * @return a skip result (only id + skip present)
         */
        public static ComponentResult skipped(String id) {
            return new ComponentResult(id, null, null, null, Boolean.TRUE);
        }
    }
}

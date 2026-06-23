/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lievit public API, organized by role. Learn the surface by what each annotation is FOR, not by
 * counting them: the set grows as parity features land (ADR-0030, ADR-0031, ...), so a fixed integer
 * is a slogan that drifts. The roles below are stable; the
 * {@code io.lievit.AnnotationTaxonomyInvariantTest} build-time test asserts that this documented set
 * is exactly the set of runtime {@code @interface} types in this package, so the doc cannot silently
 * drift from the code.
 *
 * <p><b>Bootstrap</b> — turn the framework on.
 * <ul>
 *   <li>{@link io.lievit.EnableLievit} — enable the starter autoconfiguration.
 * </ul>
 *
 * <p><b>Component</b> — declare a component.
 * <ul>
 *   <li>{@link io.lievit.LievitComponent} — mark a class as a server-side component.
 * </ul>
 *
 * <p><b>State</b> — the wire-bound fields and how they cross the wire.
 * <ul>
 *   <li>{@link io.lievit.Wire} — bind a field bidirectionally to the template.
 *   <li>{@link io.lievit.LievitProperty} — extended per-field metadata (serialize / lock / modelable).
 *   <li>{@link io.lievit.LievitComputed} — a memoized value derived from {@code @Wire} state.
 *   <li>{@link io.lievit.LievitUrl} — reflect a {@code @Wire} field into the URL query string.
 *   <li>{@link io.lievit.LievitSession} — persist a {@code @Wire} field across a full page refresh.
 * </ul>
 *
 * <p><b>Action</b> — methods the client can call, and how the response renders.
 * <ul>
 *   <li>{@link io.lievit.LievitAction} — a method callable from the template.
 *   <li>{@link io.lievit.LievitJson} — an action exposed as a JSON RPC endpoint (no re-render).
 *   <li>{@link io.lievit.LievitRenderless} — an action that skips the re-render.
 *   <li>{@link io.lievit.LievitTransition} — an action that drives the morph transition.
 * </ul>
 *
 * <p><b>Events</b> — the receiving half of dispatch.
 * <ul>
 *   <li>{@link io.lievit.LievitOn} — listen for a named browser event.
 * </ul>
 *
 * <p><b>Lifecycle</b> — hooks around mount and render.
 * <ul>
 *   <li>{@link io.lievit.LievitMount} — runs once before the first render.
 *   <li>{@link io.lievit.LievitRender} — the single-file render, or a multi-file pre-render hook.
 * </ul>
 *
 * <p><b>Authorization</b> — gate an action / listener.
 * <ul>
 *   <li>{@link io.lievit.LievitAuthorize} — a Spring Security expression guarding an action.
 * </ul>
 *
 * <p><b>Loading</b> — when and how a component's body is fetched.
 * <ul>
 *   <li>{@link io.lievit.LievitLazy} — defer the real render behind a placeholder.
 *   <li>{@link io.lievit.LievitIsolate} — send this component's updates in their own request.
 * </ul>
 *
 * <p><b>Page</b> — route-target full-page components.
 * <ul>
 *   <li>{@link io.lievit.LievitPage} — map a full-page component directly to a route.
 *   <li>{@link io.lievit.LievitLayout} — the layout a full-page component renders inside.
 *   <li>{@link io.lievit.LievitTitle} — the {@code <title>} a full-page component sets.
 * </ul>
 *
 * <p>{@code LievitFormObject} is a plain Java marker interface, not an annotation, and so is not part
 * of this set.
 */
@NullMarked
package io.lievit;

import org.jspecify.annotations.NullMarked;

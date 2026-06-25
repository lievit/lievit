/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lievit public API, organized by role. Learn the surface by what each annotation is FOR, not by
 * counting them: the set grows as parity features land (ADR-0030, ADR-0031, ...), so a fixed integer
 * is a slogan that drifts. The roles below are stable; the
 * {@code dev.lievit.AnnotationTaxonomyInvariantTest} build-time test asserts that this documented set
 * is exactly the set of runtime {@code @interface} types in this package, so the doc cannot silently
 * drift from the code.
 *
 * <p><b>Bootstrap</b> — turn the framework on.
 * <ul>
 *   <li>{@link dev.lievit.EnableLievit} — enable the starter autoconfiguration.
 * </ul>
 *
 * <p><b>Component</b> — declare a component.
 * <ul>
 *   <li>{@link dev.lievit.LievitComponent} — mark a class as a server-side component.
 * </ul>
 *
 * <p><b>State</b> — the wire-bound fields and how they cross the wire.
 * <ul>
 *   <li>{@link dev.lievit.Wire} — bind a field bidirectionally to the template.
 *   <li>{@link dev.lievit.LievitProperty} — extended per-field metadata (serialize / lock / modelable).
 *   <li>{@link dev.lievit.LievitComputed} — a memoized value derived from {@code @Wire} state.
 *   <li>{@link dev.lievit.LievitUrl} — reflect a {@code @Wire} field into the URL query string.
 *   <li>{@link dev.lievit.LievitSession} — persist a {@code @Wire} field across a full page refresh.
 * </ul>
 *
 * <p><b>Action</b> — methods the client can call, and how the response renders.
 * <ul>
 *   <li>{@link dev.lievit.LievitAction} — a method callable from the template.
 *   <li>{@link dev.lievit.LievitJson} — an action exposed as a JSON RPC endpoint (no re-render).
 *   <li>{@link dev.lievit.LievitRenderless} — an action that skips the re-render.
 *   <li>{@link dev.lievit.LievitTransition} — an action that drives the morph transition.
 * </ul>
 *
 * <p><b>Events</b> — the receiving half of dispatch.
 * <ul>
 *   <li>{@link dev.lievit.LievitOn} — listen for a named browser event.
 * </ul>
 *
 * <p><b>Lifecycle</b> — hooks around mount and render.
 * <ul>
 *   <li>{@link dev.lievit.LievitMount} — runs once before the first render.
 *   <li>{@link dev.lievit.LievitRender} — the single-file render, or a multi-file pre-render hook.
 * </ul>
 *
 * <p><b>Authorization</b> — gate an action / listener.
 * <ul>
 *   <li>{@link dev.lievit.LievitAuthorize} — a Spring Security expression guarding an action.
 * </ul>
 *
 * <p><b>Loading</b> — when and how a component's body is fetched.
 * <ul>
 *   <li>{@link dev.lievit.LievitLazy} — defer the real render behind a placeholder.
 *   <li>{@link dev.lievit.LievitIsolate} — send this component's updates in their own request.
 * </ul>
 *
 * <p><b>Page</b> — route-target full-page components.
 * <ul>
 *   <li>{@link dev.lievit.LievitPage} — map a full-page component directly to a route.
 *   <li>{@link dev.lievit.LievitLayout} — the layout a full-page component renders inside.
 *   <li>{@link dev.lievit.LievitTitle} — the {@code <title>} a full-page component sets.
 * </ul>
 *
 * <p>{@code LievitFormObject} is a plain Java marker interface, not an annotation, and so is not part
 * of this set.
 */
@NullMarked
package dev.lievit;

import org.jspecify.annotations.NullMarked;

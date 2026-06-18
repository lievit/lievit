/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler;

import java.util.Set;

/**
 * The canonical set of {@code l:<name>} client-directive names lievit ships, the single source of
 * truth the {@link DirectiveValidator} checks an authored template against (issue: unknown-directive
 * poka-yoke). A directive carried by a template that is not in this set is a build/startup error,
 * never a silent runtime no-op (the bug this prevents: {@code <button l:value="...">} armed nothing
 * in the browser because {@code l:value} is not a directive and the client registry ignored it).
 *
 * <h2>The set IS the client runtime's registry</h2>
 *
 * Every name here is registered by the client runtime under {@code lievit-ui/runtime/}: a directive
 * declares the bare {@code l:} name it binds and the runtime scans for it (see
 * {@code runtime/directives.ts} §builtins, {@code runtime/v4-directives.ts}, and the
 * {@code runtime/features/*.ts} installers). This Java list is a hand-mirrored copy of that
 * TypeScript registry: the two live in different languages and cannot share a literal, so they
 * <strong>can drift</strong>. The drift is pinned two ways:
 *
 * <ul>
 *   <li>{@code DirectiveNamesParityTest} reads the runtime TypeScript sources and asserts every
 *       {@code name:}/{@code l:<name>} the runtime registers is present here (and vice-versa), so a
 *       new client directive that forgets to update this list fails the build;
 *   <li>each name below is annotated with the runtime source that registers it, so a reviewer can
 *       trace it by hand.
 * </ul>
 *
 * <p>A name without the {@code l:} prefix; modifiers ({@code .live}, {@code .enter}, {@code .500ms},
 * {@code .disabled}) are validated structurally by the {@link DirectiveValidator}, not enumerated
 * here (they are open per directive). Magic actions in the directive <em>value</em>
 * ({@code l:click="$set(...)"}) are not directives and are out of scope: the directive name is
 * {@code click}, which is valid.
 */
public final class DirectiveNames {

    private DirectiveNames() {}

    /**
     * The built-in + v4 + feature directive names, mirrored from the client runtime registry. Keep
     * sorted and annotated with the registering runtime source so the parity test and a human
     * reviewer can both trace each entry.
     */
    public static final Set<String> BUILTIN =
            Set.of(
                    // --- runtime/directives.ts : builtinDirectives() (wire-protocol §5) ----------
                    "click", // actionDirective("click")
                    "submit", // submitDirective
                    "keydown", // keydownDirective (modifier = key, e.g. l:keydown.enter)
                    "model", // modelDirective (modifiers .live/.lazy/.blur/.debounce.Nms)

                    // --- runtime/v4-directives.ts : registerV4Directives() (ADR-0024) ------------
                    "bind", // bindDirective (l:bind.<attr>)
                    "text", // textDirective
                    "dirty", // dirtyDirective (#85)
                    "errors", // errorsDirective (#101)
                    "error", // errorDirective (#101)
                    "ref", // refDirective (#109); also a reserved mount-tag attr
                    "sort", // sortDirective (#111)
                    "target", // l:target / l:target.except scoping (loading.ts, dirty.ts)
                    "async", // asyncActionDirective (l:click.async race path) (runtime.ts, #97)

                    // --- runtime/features/*.ts : install* directives (Epic #34) ------------------
                    "confirm", // features/confirm.ts (#83)
                    "current", // features/current.ts
                    "ignore", // features/ignore.ts (.self/.children)
                    "init", // features/init.ts
                    "show", // features/show.ts
                    "lazy", // features/lazy.ts
                    "loading", // features/loading.ts (#125)
                    "navigate", // features/navigate.ts (#50)
                    "persist", // features/navigate.ts (l:persist across navigations)
                    "page", // features/pagination.ts
                    "poll", // features/poll.ts
                    "preserve-scroll", // features/preserve-scroll.ts
                    "scope", // features/scoped-css.ts (<style l:scope>) (#129)
                    "teleport", // features/teleport.ts (#52)
                    "transition", // features/transition.ts
                    "upload", // features/uploads.ts (#159)
                    "stream", // features/stream.ts (l:stream target) (#101 stream)

                    // --- runtime.ts : structural attributes the runtime reads directly ----------
                    "island", // runtime.ts island routing (#89)
                    "key"); // explicit key namespace (also a reserved mount-tag attr)
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Lucide icons (ISC, https://lucide.dev) -- see registry/icons/LICENSE-lucide.
 */
package dev.lievit.ui;

/**
 * SPI for resolving an icon name to its inner SVG markup (the {@code <path>}/{@code <circle>}/...
 * elements that go inside the uniform {@code <svg>} wrapper rendered by {@code lievit/icon.jte}).
 *
 * <p>lievit OWNS this contract and ships a default implementation ({@link LucideIconResolver}, the
 * bundled tree-shaken Lucide set), so the {@code icon} partial renders standalone with ZERO adopter
 * classpath: copy {@code icon.jte} in and it works out of the box. An adopter who wants a different
 * icon set (a larger Lucide vendor, an in-house brand set, a sprite-backed source) implements this
 * interface and registers it via {@link LievitIcons#setResolver(IconResolver)} -- the partial's
 * {@code @import static dev.lievit.ui.LievitIcons.body} call site never changes.
 *
 * <p>Invariant: an unknown name returns {@code ""} (empty markup), never {@code null} and never a
 * thrown exception. The partial emits the result with {@code $unsafe{...}}, so a resolver MUST only
 * ever return markup it trusts (vendored, not user-supplied).
 */
@FunctionalInterface
public interface IconResolver {

  /** The inner SVG markup for {@code name}, or {@code ""} if the icon is not known. Never null. */
  String body(String name);

  /** Whether {@code name} resolves to non-empty markup. Default: derived from {@link #body}. */
  default boolean has(String name) {
    return !body(name).isEmpty();
  }
}

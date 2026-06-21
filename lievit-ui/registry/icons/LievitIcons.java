/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Lucide icons (ISC, https://lucide.dev) -- see registry/icons/LICENSE-lucide.
 */
package io.lievit.ui;

/**
 * Static entry point the {@code lievit/icon.jte} partial imports ({@code @import static
 * io.lievit.ui.LievitIcons.body}). It delegates to a swappable {@link IconResolver} so the partial
 * renders standalone -- the default resolver is lievit's own bundled, tree-shaken Lucide set
 * ({@link LucideIconResolver}), so the component works with ZERO adopter classpath out of the box.
 *
 * <p>To ship a different icon set, an adopter calls {@link #setResolver(IconResolver)} once at
 * startup (e.g. from a Spring {@code @Configuration}) with their own {@link IconResolver}; the JTE
 * call site is untouched. The default is also the simplest override: the copy-in source is yours,
 * so editing {@link LucideIconResolver} (add a {@code .svg}, re-run the generator) is the no-code
 * path.
 *
 * <p>This indirection is what de-couples the partial from any concrete icon source: there is NO
 * adopter class referenced anywhere in {@code icon.jte}, only this lievit-owned facade.
 */
public final class LievitIcons {
  private LievitIcons() {}

  /** lievit's own default: the bundled tree-shaken Lucide set. Swappable, never null. */
  private static volatile IconResolver resolver = new LucideIconResolver();

  /**
   * Install a custom resolver (an adopter's icon set). Idempotent; call once at startup.
   *
   * @param custom the resolver to use; must not be null
   */
  public static void setResolver(IconResolver custom) {
    if (custom == null) {
      throw new IllegalArgumentException("IconResolver must not be null");
    }
    resolver = custom;
  }

  /** The currently installed resolver (lievit's bundled Lucide set unless overridden). */
  public static IconResolver resolver() {
    return resolver;
  }

  /** The inner SVG markup for {@code name}, or {@code ""} if unknown. The JTE partial's call site. */
  public static String body(String name) {
    return resolver.body(name);
  }

  /** Whether {@code name} is known to the installed resolver. */
  public static boolean has(String name) {
    return resolver.has(name);
  }
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Minimal ambient type for Vite's `import.meta.glob` (the controller autoloader in
 * `application.ts`). lievit-ui's tsconfig pins `types: ["node"]`, and `vite/client` is not directly
 * resolvable from this package (vite is a transitive dep), so we declare the one method we use
 * rather than pull the whole `vite/client` surface. Vite replaces the call at transform time; this
 * only keeps `tsc --noEmit` honest.
 */
interface ImportMeta {
  glob(
    pattern: string,
    options: { eager: true },
  ): Record<string, { readonly default: unknown }>;
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import type { Registry } from "../../cli/registry.js";

/**
 * A SYNTHETIC `registry:ui` fixture for the CLI single-root copy-in contract.
 *
 * After the server-first pivot (ADR-0012) the library ships NO `registry:ui` Lit island, so the
 * legacy single-root `lievit add` behaviour can no longer be exercised against a shipped
 * component. This fixture fabricates the canonical legacy closure (tokens + a lib helper + a
 * `registry:ui` widget that depends on both, npm dep `lit`) with inlined content, so the CLI
 * mechanism is tested in isolation, robust to the island purge. The content is owned by the
 * test, so byte-identity assertions compare against the constants below, not a disk source.
 */

export const TOKENS_CONTENT = "/* lievit design tokens */\n:root{--lv-color-fg:#111}\n";
export const LIGHT_DOM_CONTENT = "// adoptLightStyles helper (registry:lib)\nexport const adoptLightStyles = () => {};\n";
export const WIDGET_CONTENT =
  "// a synthetic registry:ui Lit island fixture\nexport class LvWidget extends HTMLElement {}\n";

/** The golden file set `lievit add widget` produces under the `src` alias root, in closure order. */
export const WIDGET_GOLDEN_FILES = [
  "styles/lievit-tokens.css",
  "components/ui/light-dom.ts",
  "components/ui/widget.ts",
] as const;

export function syntheticUiRegistry(): Registry {
  return {
    name: "lievit-ui-test",
    homepage: "",
    items: [
      {
        name: "tokens",
        type: "registry:tokens",
        description: "design tokens",
        dependencies: [],
        registryDependencies: [],
        tokens: [],
        docs: "",
        files: [
          {
            path: "tokens/lievit-tokens.css",
            type: "registry:tokens",
            target: "styles/lievit-tokens.css",
            content: TOKENS_CONTENT,
          },
        ],
      },
      {
        name: "light-dom",
        type: "registry:lib",
        description: "light-DOM style helper",
        dependencies: [],
        registryDependencies: [],
        tokens: [],
        docs: "",
        files: [
          {
            path: "components/light-dom/light-dom.ts",
            type: "registry:lib",
            target: "components/ui/light-dom.ts",
            content: LIGHT_DOM_CONTENT,
          },
        ],
      },
      {
        name: "widget",
        type: "registry:ui",
        description: "a synthetic presentation island",
        dependencies: ["lit"],
        registryDependencies: ["tokens", "light-dom"],
        tokens: [],
        docs: "import and register <lv-widget>",
        files: [
          {
            path: "components/widget/widget.ts",
            type: "registry:ui",
            target: "components/ui/widget.ts",
            content: WIDGET_CONTENT,
          },
        ],
      },
    ],
  };
}

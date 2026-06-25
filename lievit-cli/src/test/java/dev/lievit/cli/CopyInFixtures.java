package dev.lievit.cli;

import dev.lievit.cli.registry.Registry;
import dev.lievit.cli.registry.RegistryLoader;

/**
 * Shared registry fixture for the copy-in command tests ({@code add}/{@code diff}/{@code update}/
 * {@code init}). A hand-built two-item registry (button -> tokens) parsed via {@link RegistryLoader}
 * lets each command test run against a real {@link Registry} through the {@code (projectDir,
 * registry)} test seam, independent of the bundled {@code registry.json}.
 */
final class CopyInFixtures {

    static final String BUTTON_CONTENT = "@param String label\n<button>${label}</button>\n";
    static final String TOKENS_CONTENT = ":root { --lv-color: #000; }\n";

    private CopyInFixtures() {}

    static Registry registry() {
        String json =
                """
                {
                  "name": "lievit-ui",
                  "homepage": "https://example",
                  "items": [
                    {
                      "name": "tokens", "type": "registry:tokens", "description": "design tokens",
                      "registryDependencies": [], "tokens": [], "docs": "import once",
                      "files": [
                        {"path": "tokens/lievit-tokens.css", "type": "registry:tokens",
                         "target": "styles/lievit-tokens.css", "content": "%s"}
                      ]
                    },
                    {
                      "name": "button", "type": "registry:jte", "description": "a button",
                      "registryDependencies": ["tokens"], "tokens": [], "docs": "owns its source",
                      "files": [
                        {"path": "jte/button.jte", "type": "registry:jte", "root": "jte",
                         "target": "lievit/button.jte", "content": "%s"}
                      ]
                    }
                  ]
                }
                """
                        .formatted(escape(TOKENS_CONTENT), escape(BUTTON_CONTENT));
        return RegistryLoader.fromJson(json);
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\n", "\\n").replace("\"", "\\\"");
    }
}

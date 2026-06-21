package io.lievit.cli.registry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import io.lievit.cli.registry.Registry.Item;

/**
 * Unit spec for the registry model: the Java mirror of registry.ts's {@code resolve}. Pins the
 * transitive-closure + topological order so {@code add}/{@code diff}/{@code update} always copy a
 * dependency (e.g. {@code tokens}) before the component that needs it.
 */
class RegistryTest {

    private static final String JSON =
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
                     "target": "styles/lievit-tokens.css", "content": "/* tokens */\\n"}
                  ]
                },
                {
                  "name": "button", "type": "registry:jte", "description": "a button",
                  "registryDependencies": ["tokens"], "tokens": [], "docs": "",
                  "files": [
                    {"path": "jte/button.jte", "type": "registry:jte", "root": "jte",
                     "target": "lievit/button.jte", "content": "@param String label\\n"}
                  ]
                }
              ]
            }
            """;

    /**
     * @spec.given a registry where button depends on tokens
     * @spec.when button is resolved
     * @spec.then the closure is {tokens, button} with the dependency emitted first
     */
    @Test
    void resolve_returns_dependencies_before_dependents() {
        Registry registry = RegistryLoader.fromJson(JSON);

        List<Item> ordered = registry.resolve(List.of("button"));

        assertThat(ordered).extracting(Item::name).containsExactly("tokens", "button");
    }

    /**
     * @spec.given a registry that does not contain the requested name
     * @spec.when it is resolved
     * @spec.then resolution fails loudly rather than copying nothing
     */
    @Test
    void resolve_unknown_name_throws() {
        Registry registry = RegistryLoader.fromJson(JSON);

        assertThatThrownBy(() -> registry.resolve(List.of("nope")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unknown registry item: nope");
    }

    /**
     * @spec.given a jte-root file (button) and an alias-root file (tokens)
     * @spec.when the copy is planned against the default roots
     * @spec.then each target lands under the root it declares
     */
    @Test
    void planner_resolves_each_file_under_its_declared_root() {
        Registry registry = RegistryLoader.fromJson(JSON);

        List<CopyPlanner.FileCopy> plan =
                CopyPlanner.plan(registry, List.of("button"), AdopterRoots.defaults());

        assertThat(plan).extracting(CopyPlanner.FileCopy::dest)
                .containsExactly("src/styles/lievit-tokens.css", "src/main/jte/lievit/button.jte");
    }
}

package dev.lievit.cli.registry;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Loads the consolidated {@code registry.json} the copy-in commands resolve against.
 *
 * <p>The registry is BUNDLED on the CLI classpath at {@code /registry.json} (the cli pom copies
 * {@code ../lievit-ui/registry/registry.json} into {@code target/classes} at build time, so the
 * single source of truth stays the {@code npm run build:registry} output and no duplicate is
 * committed). Loading from the classpath means {@code add} needs NO network — the manifest plus
 * every component's verbatim {@code content} ships inside the fat-jar.
 */
public final class RegistryLoader {

    /** The bundled registry resource path on the CLI classpath. */
    public static final String RESOURCE = "/registry.json";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private RegistryLoader() {}

    /**
     * Loads the registry bundled on the CLI classpath.
     *
     * @return the parsed registry
     * @throws IllegalStateException if the resource is missing from the classpath
     * @throws UncheckedIOException  if the resource cannot be parsed
     */
    public static Registry fromClasspath() {
        try (InputStream in = RegistryLoader.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException(
                        "registry.json is not on the CLI classpath (" + RESOURCE
                                + "). The cli build copies it from lievit-ui/registry/; run a full build.");
            }
            return MAPPER.readValue(in, Registry.class);
        } catch (IOException e) {
            throw new UncheckedIOException("failed to parse bundled " + RESOURCE, e);
        }
    }

    /**
     * Parses a registry from a raw JSON string. Test seam: lets a command run against a hand-built
     * registry without touching the classpath.
     *
     * @param json the registry JSON
     * @return the parsed registry
     * @throws UncheckedIOException if the JSON cannot be parsed
     */
    public static Registry fromJson(String json) {
        try {
            return MAPPER.readValue(json, Registry.class);
        } catch (IOException e) {
            throw new UncheckedIOException("failed to parse registry JSON", e);
        }
    }
}

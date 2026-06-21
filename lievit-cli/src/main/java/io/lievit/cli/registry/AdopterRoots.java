package io.lievit.cli.registry;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * The adopter's destination roots — the Java mirror of the {@code AddConfig} in add.ts and the
 * {@code lievit.json} {@code root} / {@code roots.{java,jte}} fields.
 *
 * <p>A registry file declares which root resolves its {@code target} (ADR-0012 server-first):
 * <ul>
 *   <li>{@code "java"} → the Java source root (default {@code src/main/java});</li>
 *   <li>{@code "jte"} → the JTE templates root (default {@code src/main/jte});</li>
 *   <li>absent / {@code "alias"} → the single alias root (default {@code src}).</li>
 * </ul>
 *
 * @param alias the alias root for presentation-only files ({@code lievit.json} {@code root})
 * @param java  the Java source root ({@code roots.java})
 * @param jte   the JTE templates root ({@code roots.jte})
 */
public record AdopterRoots(String alias, String java, String jte) {

    /** The conventional defaults when no {@code lievit.json} is present. */
    public static AdopterRoots defaults() {
        return new AdopterRoots("src", "src/main/java", "src/main/jte");
    }

    /** Returns a copy with the alias root overridden (the {@code --root} flag). */
    public AdopterRoots withAlias(String overrideAlias) {
        return new AdopterRoots(overrideAlias, java, jte);
    }

    /**
     * Resolves the root for a file's declared {@code root} marker.
     *
     * @param fileRoot the file's {@code root} ({@code "java"}, {@code "jte"}, or absent/{@code "alias"})
     * @return the matching adopter root
     */
    public String rootFor(String fileRoot) {
        if ("java".equals(fileRoot)) {
            return java;
        }
        if ("jte".equals(fileRoot)) {
            return jte;
        }
        return alias;
    }

    /**
     * Loads the adopter roots from {@code <projectDir>/lievit.json} if present, else the conventional
     * defaults. Mirrors {@code loadConfig} in lievit-add.ts: absent fields fall back to the defaults,
     * so a presentation-only {@code lievit.json} (just {@code root}) still works.
     *
     * @param projectDir the adopter project root
     * @return the resolved roots
     * @throws UncheckedIOException if {@code lievit.json} exists but cannot be read/parsed
     */
    public static AdopterRoots load(Path projectDir) {
        Path config = projectDir.resolve("lievit.json");
        if (!Files.isRegularFile(config)) {
            return defaults();
        }
        try {
            LievitJson cfg = new ObjectMapper().readValue(Files.readString(config), LievitJson.class);
            AdopterRoots d = defaults();
            String alias = cfg.root != null ? cfg.root : d.alias();
            String javaRoot = cfg.roots != null && cfg.roots.java != null ? cfg.roots.java : d.java();
            String jteRoot = cfg.roots != null && cfg.roots.jte != null ? cfg.roots.jte : d.jte();
            return new AdopterRoots(alias, javaRoot, jteRoot);
        } catch (IOException e) {
            throw new UncheckedIOException("failed to read lievit.json at " + config, e);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static final class LievitJson {
        public String root;
        public Roots roots;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static final class Roots {
        public String java;
        public String jte;
    }
}

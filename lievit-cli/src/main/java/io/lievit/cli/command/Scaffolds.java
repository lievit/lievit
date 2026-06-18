package io.lievit.cli.command;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Shared project-layout helpers for the {@code make:*} scaffold commands (issue #141): PascalCase
 * validation, the kebab-case name normalization the template file uses, and the package inference
 * that finds the project's single root package under {@code src/main/java}. Kept in one place so the
 * component / form / future generators stay consistent (one rule, one bug surface).
 */
final class Scaffolds {

    private final Path workingDir;

    Scaffolds(Path workingDir) {
        this.workingDir = workingDir;
    }

    /** A valid component name is a PascalCase Java identifier. */
    boolean isValidClassName(String candidate) {
        return candidate != null && candidate.matches("[A-Z][A-Za-z0-9_]*");
    }

    /**
     * Infers the project package: the deepest single-chain package directory under
     * {@code src/main/java} (the common case of one root package), else the empty (default) package.
     *
     * @param javaRoot the {@code src/main/java} directory
     * @return the inferred dotted package, or {@code ""} when none can be inferred
     */
    String inferPackage(Path javaRoot) {
        StringBuilder pkg = new StringBuilder();
        Path current = javaRoot;
        while (true) {
            Path onlyChild = soleSubdirectory(current);
            if (onlyChild == null) {
                break;
            }
            if (pkg.length() > 0) {
                pkg.append('.');
            }
            pkg.append(onlyChild.getFileName().toString());
            current = onlyChild;
        }
        return pkg.toString();
    }

    /** Returns the single sub-directory of {@code dir}, or null when there are zero or many. */
    private Path soleSubdirectory(Path dir) {
        try (var stream = Files.list(dir)) {
            var subdirs = stream.filter(Files::isDirectory).toList();
            return subdirs.size() == 1 ? subdirs.get(0) : null;
        } catch (IOException e) {
            return null;
        }
    }

    /** The working directory this helper resolves project paths against. */
    Path workingDir() {
        return workingDir;
    }

    /** PascalCase -&gt; kebab-case (Counter -&gt; counter, UserList -&gt; user-list). */
    static String kebab(String pascal) {
        return pascal.replaceAll("([a-z0-9])([A-Z])", "$1-$2").toLowerCase();
    }
}

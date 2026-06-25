package dev.lievit.cli.registry;

import java.util.ArrayList;
import java.util.List;

/**
 * Plans a copy-in without touching disk — the Java mirror of {@code planAdd} in add.ts.
 *
 * <p>It resolves the requested names to their transitive item closure, then for each file computes
 * the destination ({@code <root>/<target>}) under the adopter root the file declares. The result is
 * a pure, ordered list of {@link FileCopy}s (dependencies before dependents); the effectful commands
 * ({@code add}/{@code update}/{@code init}) decide whether each one is written, skipped, or diffed.
 */
public final class CopyPlanner {

    private CopyPlanner() {}

    /**
     * One file to copy, with its resolved destination and verbatim content.
     *
     * @param item    the registry item this file belongs to
     * @param dest    destination relative to the project root, POSIX-separated (e.g.
     *                {@code src/main/jte/lievit/button.jte})
     * @param content the verbatim content to write
     */
    public record FileCopy(String item, String dest, String content) {}

    /**
     * Plans the file copies for the requested names.
     *
     * @param registry the consolidated registry
     * @param names    requested item names
     * @param roots    the adopter's destination roots
     * @return the ordered file copies (dependencies first)
     * @throws IllegalArgumentException if a requested name or dependency edge is unknown
     */
    public static List<FileCopy> plan(Registry registry, List<String> names, AdopterRoots roots) {
        List<FileCopy> copies = new ArrayList<>();
        for (Registry.Item item : registry.resolve(names)) {
            for (Registry.File file : item.files()) {
                String dest = joinDest(roots.rootFor(file.root()), file.target());
                copies.add(new FileCopy(item.name(), dest, file.content()));
            }
        }
        return copies;
    }

    /** Joins a root with a target path using forward slashes (registry paths are POSIX). */
    static String joinDest(String root, String target) {
        String left = root.replaceAll("/+$", "");
        return left.isEmpty() ? target : left + "/" + target;
    }
}

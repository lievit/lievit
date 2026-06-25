package dev.lievit.cli.command;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Callable;

import dev.lievit.cli.registry.AdopterRoots;
import dev.lievit.cli.registry.CopyPlanner;
import dev.lievit.cli.registry.CopyPlanner.FileCopy;
import dev.lievit.cli.registry.Registry;
import dev.lievit.cli.registry.RegistryLoader;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

/**
 * {@code lievit add <component...>} — the shadcn-style copy-in: resolve a component against the
 * bundled registry (following its {@code registryDependencies}, e.g. {@code tokens}) and WRITE each
 * file's verbatim source into the adopter's tree under the registry-declared root (a {@code jte}
 * file like {@code lievit/button.jte} lands under {@code src/main/jte}, a {@code java} file under
 * {@code src/main/java}, an alias file under {@code src}).
 *
 * <p>The copied source becomes the adopter's: they own and edit it (ADR-0009). So {@code add} is
 * idempotent and SAFE — it refuses to clobber a file that already exists unless {@code --overwrite}
 * is passed; the adopter who wants upstream changes runs {@code lievit diff} first, then
 * {@code lievit update}. No network is needed: the registry plus every component's content ships on
 * the classpath.
 *
 * <p>Exit codes: 0 = files written (or all skipped), 1 = an unknown component / write error.
 */
@Command(
    name = "add",
    mixinStandardHelpOptions = true,
    description = {
        "Copy a lievit-ui component (and its dependencies) into your project.",
        "",
        "Resolves <component> in the bundled registry, follows registryDependencies (e.g. tokens),",
        "and writes each file's source under your jte/java/alias root. The copy is yours to edit;",
        "an existing file is kept unless --overwrite. No network required."
    },
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Component(s) added (or already present and skipped).",
        " 1:Unknown component, or a file could not be written."
    })
public class AddCommand implements Callable<Integer> {

    @Parameters(
        index = "0..*",
        paramLabel = "<component>",
        description = "One or more registry component names to copy in (e.g. button input).")
    List<String> names = List.of();

    @Option(
        names = "--overwrite",
        description = "Overwrite a destination file that already exists (default: skip it).")
    boolean overwrite;

    @Option(
        names = "--root",
        paramLabel = "<dir>",
        description = "Alias root for non-jte/java files (default: from lievit.json, else 'src').")
    String root;

    @Option(
        names = "--dry-run",
        description = "Print the plan without writing any file.")
    boolean dryRun;

    private final Path projectDir;
    private final Registry registry;

    /** Production constructor: resolve against the process working dir and the bundled registry. */
    public AddCommand() {
        this(Path.of(System.getProperty("user.dir")), RegistryLoader.fromClasspath());
    }

    /**
     * Test seam.
     *
     * @param projectDir the directory treated as the adopter project root
     * @param registry   the registry to resolve against
     */
    public AddCommand(Path projectDir, Registry registry) {
        this.projectDir = projectDir;
        this.registry = registry;
    }

    @Override
    public Integer call() {
        if (names.isEmpty()) {
            System.err.println("Error: name at least one component, e.g. `lievit add button`.");
            return 1;
        }
        AdopterRoots roots = AdopterRoots.load(projectDir);
        if (root != null && !root.isBlank()) {
            roots = roots.withAlias(root);
        }

        List<FileCopy> plan;
        try {
            plan = CopyPlanner.plan(registry, names, roots);
        } catch (IllegalArgumentException e) {
            System.err.println("Error: " + e.getMessage());
            return 1;
        }

        System.out.println("Resolving " + String.join(", ", names));
        int written = 0;
        int skipped = 0;
        for (FileCopy copy : plan) {
            Path dest = projectDir.resolve(copy.dest());
            boolean exists = Files.exists(dest);
            if (exists && !overwrite) {
                System.out.println("  skip  " + copy.dest() + " (exists; --overwrite to replace)");
                skipped++;
                continue;
            }
            String verb = exists ? "over " : "copy ";
            if (dryRun) {
                System.out.println("  " + verb + " " + copy.dest());
                continue;
            }
            try {
                writeFile(dest, copy.content());
            } catch (IOException e) {
                System.err.println("Error writing " + copy.dest() + ": " + e.getMessage());
                return 1;
            }
            System.out.println("  " + verb + " " + copy.dest());
            written++;
        }

        if (dryRun) {
            System.out.println("Dry run: no files written.");
            return 0;
        }
        printDocs(names);
        System.out.println(
                "Done: " + written + " file(s) written, " + skipped + " skipped. "
                        + "The copied source is yours to edit.");
        return 0;
    }

    /** Prints each resolved item's post-copy note (run after a real write). */
    private void printDocs(List<String> requested) {
        for (Registry.Item item : registry.resolve(requested)) {
            if (!item.docs().isBlank()) {
                System.out.println("note: " + item.name() + ": " + item.docs());
            }
        }
    }

    static void writeFile(Path dest, String content) throws IOException {
        Path parent = dest.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        Files.writeString(dest, content, StandardCharsets.UTF_8);
    }
}

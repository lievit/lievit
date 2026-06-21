package io.lievit.cli.command;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Callable;

import io.lievit.cli.registry.AdopterRoots;
import io.lievit.cli.registry.CopyPlanner;
import io.lievit.cli.registry.CopyPlanner.FileCopy;
import io.lievit.cli.registry.Registry;
import io.lievit.cli.registry.RegistryLoader;
import io.lievit.cli.registry.UnifiedDiff;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

/**
 * {@code lievit diff <component>} — show how the adopter's local copy of a copied-in component has
 * drifted from the registry's current {@code content}.
 *
 * <p>Because the adopter OWNS the copied source (ADR-0009), {@code update} would clobber their edits.
 * {@code diff} is the safety valve they run first: it resolves the component (and its
 * dependencies), reads each local file at its destination, and prints a unified diff against the
 * registry content. A clean (identical) component prints nothing on stdout and exits 0; any drift
 * prints the diff and exits 1, so {@code diff} doubles as a CI drift gate.
 *
 * <p>Exit codes: 0 = local copies match the registry, 1 = at least one file drifted (or is missing
 * locally), 2 = an unknown component (usage error).
 */
@Command(
    name = "diff",
    mixinStandardHelpOptions = true,
    description = {
        "Show the diff between your local copy of a component and the registry's current source.",
        "",
        "Run this before `lievit update` to see what upstream changed (and what local edits you",
        "would lose). Exits 1 when anything differs, so it works as a CI drift gate too."
    },
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Local copies are identical to the registry.",
        " 1:At least one file differs or is missing locally.",
        " 2:Unknown component."
    })
public class DiffCommand implements Callable<Integer> {

    @Parameters(
        index = "0..*",
        paramLabel = "<component>",
        description = "One or more registry component names to diff against your local copy.")
    List<String> names = List.of();

    @Option(
        names = "--root",
        paramLabel = "<dir>",
        description = "Alias root for non-jte/java files (default: from lievit.json, else 'src').")
    String root;

    private final Path projectDir;
    private final Registry registry;

    /** Production constructor. */
    public DiffCommand() {
        this(Path.of(System.getProperty("user.dir")), RegistryLoader.fromClasspath());
    }

    /**
     * Test seam.
     *
     * @param projectDir the adopter project root
     * @param registry   the registry to resolve against
     */
    public DiffCommand(Path projectDir, Registry registry) {
        this.projectDir = projectDir;
        this.registry = registry;
    }

    @Override
    public Integer call() {
        if (names.isEmpty()) {
            System.err.println("Error: name at least one component, e.g. `lievit diff button`.");
            return 2;
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
            return 2;
        }

        boolean anyDrift = false;
        for (FileCopy copy : plan) {
            Path dest = projectDir.resolve(copy.dest());
            if (!Files.isRegularFile(dest)) {
                System.out.println("# " + copy.dest() + ": not copied locally (run `lievit add`).");
                anyDrift = true;
                continue;
            }
            String local = read(dest);
            if (UnifiedDiff.differ(local, copy.content())) {
                System.out.println(UnifiedDiff.diff(copy.dest(), local, copy.content()));
                anyDrift = true;
            }
        }

        if (!anyDrift) {
            System.out.println(
                    "[OK] " + String.join(", ", names)
                            + ": local copies are identical to the registry.");
            return 0;
        }
        return 1;
    }

    private static String read(Path file) {
        try {
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("failed reading " + file, e);
        }
    }
}

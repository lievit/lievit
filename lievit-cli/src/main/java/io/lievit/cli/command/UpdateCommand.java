package io.lievit.cli.command;

import java.io.IOException;
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
 * {@code lievit update <component>} — re-copy the registry's current source over the adopter's local
 * copy of a component (and its dependencies).
 *
 * <p>This is the {@code add --overwrite} of an already-ejected component. Because the copied source
 * is the adopter's to edit (ADR-0009), re-copying DISCARDS their local edits — so the command surfaces
 * exactly which files it will replace (and warns when a replaced file had local changes), and tells
 * the adopter to run {@code lievit diff} first if they have not. {@code --dry-run} previews the set
 * without writing; a file that does not exist locally is created (treated like {@code add}).
 *
 * <p>Exit codes: 0 = files updated (or nothing to do), 1 = an unknown component / write error.
 */
@Command(
    name = "update",
    mixinStandardHelpOptions = true,
    description = {
        "Re-copy a component's registry source over your local copy (overwrites local edits).",
        "",
        "Run `lievit diff <component>` first to see what you would lose. Use --dry-run to preview",
        "the file set without writing."
    },
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Component(s) updated (or already up to date).",
        " 1:Unknown component, or a file could not be written."
    })
public class UpdateCommand implements Callable<Integer> {

    @Parameters(
        index = "0..*",
        paramLabel = "<component>",
        description = "One or more registry component names to re-copy over your local copy.")
    List<String> names = List.of();

    @Option(
        names = "--root",
        paramLabel = "<dir>",
        description = "Alias root for non-jte/java files (default: from lievit.json, else 'src').")
    String root;

    @Option(
        names = "--dry-run",
        description = "Print the files that would be replaced without writing them.")
    boolean dryRun;

    private final Path projectDir;
    private final Registry registry;

    /** Production constructor. */
    public UpdateCommand() {
        this(Path.of(System.getProperty("user.dir")), RegistryLoader.fromClasspath());
    }

    /**
     * Test seam.
     *
     * @param projectDir the adopter project root
     * @param registry   the registry to resolve against
     */
    public UpdateCommand(Path projectDir, Registry registry) {
        this.projectDir = projectDir;
        this.registry = registry;
    }

    @Override
    public Integer call() {
        if (names.isEmpty()) {
            System.err.println("Error: name at least one component, e.g. `lievit update button`.");
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

        System.out.println("Updating " + String.join(", ", names) + " from the registry.");
        int changed = 0;
        boolean warnedDrift = false;
        for (FileCopy copy : plan) {
            Path dest = projectDir.resolve(copy.dest());
            boolean exists = Files.exists(dest);
            boolean hadLocalEdits = exists && localDiffers(dest, copy.content());
            if (hadLocalEdits) {
                warnedDrift = true;
            }
            if (exists && !hadLocalEdits) {
                System.out.println("  same  " + copy.dest());
                continue;
            }
            String verb = !exists ? "new  " : "over ";
            if (dryRun) {
                System.out.println("  " + verb + " " + copy.dest()
                        + (hadLocalEdits ? "  (local edits would be lost)" : ""));
                continue;
            }
            try {
                AddCommand.writeFile(dest, copy.content());
            } catch (IOException e) {
                System.err.println("Error writing " + copy.dest() + ": " + e.getMessage());
                return 1;
            }
            System.out.println("  " + verb + " " + copy.dest()
                    + (hadLocalEdits ? "  (local edits replaced)" : ""));
            changed++;
        }

        if (dryRun) {
            System.out.println("Dry run: no files written.");
            return 0;
        }
        if (warnedDrift) {
            System.out.println(
                    "warning: replaced local edits. Run `lievit diff` before update next time.");
        }
        System.out.println("Done: " + changed + " file(s) updated.");
        return 0;
    }

    private static boolean localDiffers(Path dest, String upstream) {
        try {
            return UnifiedDiff.differ(Files.readString(dest, StandardCharsets.UTF_8), upstream);
        } catch (IOException e) {
            return true;
        }
    }
}

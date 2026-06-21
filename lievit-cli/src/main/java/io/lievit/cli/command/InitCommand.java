package io.lievit.cli.command;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Callable;

import io.lievit.cli.registry.AdopterRoots;
import io.lievit.cli.registry.CopyPlanner;
import io.lievit.cli.registry.CopyPlanner.FileCopy;
import io.lievit.cli.registry.Registry;
import io.lievit.cli.registry.RegistryLoader;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

/**
 * {@code lievit init} — scaffold an adopter for the copy-in flow.
 *
 * <p>It is the minimal, idempotent first step shadcn's {@code init} performs: ensure the JTE
 * templates root exists (so the first {@code lievit add button} has somewhere to land) and drop the
 * design {@code tokens} (the {@code --lv-*} {@code @theme}) into the alias root, then print the next
 * steps. It writes nothing that already exists — re-running is a no-op that just re-prints the
 * guidance. It does NOT generate a {@code lievit.json}; absent config means the conventional roots,
 * which is exactly what a fresh project wants.
 *
 * <p>Exit codes: 0 = scaffolded (or already present), 1 = a write error.
 */
@Command(
    name = "init",
    mixinStandardHelpOptions = true,
    description = {
        "Scaffold this project for lievit-ui copy-in: ensure the JTE root, drop the design tokens,",
        "and print the next steps. Idempotent.",
        "",
        "After init, copy components with `lievit add <component>`."
    },
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Scaffolded (or already present).",
        " 1:A file could not be written."
    })
public class InitCommand implements Callable<Integer> {

    @Option(
        names = "--root",
        paramLabel = "<dir>",
        description = "Alias root for the tokens file (default: from lievit.json, else 'src').")
    String root;

    private final Path projectDir;
    private final Registry registry;

    /** Production constructor. */
    public InitCommand() {
        this(Path.of(System.getProperty("user.dir")), RegistryLoader.fromClasspath());
    }

    /**
     * Test seam.
     *
     * @param projectDir the adopter project root
     * @param registry   the registry to resolve the tokens item against
     */
    public InitCommand(Path projectDir, Registry registry) {
        this.projectDir = projectDir;
        this.registry = registry;
    }

    @Override
    public Integer call() {
        AdopterRoots roots = AdopterRoots.load(projectDir);
        if (root != null && !root.isBlank()) {
            roots = roots.withAlias(root);
        }

        // 1) Ensure the JTE templates root exists so the first `add` has a destination.
        Path jteRoot = projectDir.resolve(roots.jte());
        try {
            Files.createDirectories(jteRoot);
        } catch (IOException e) {
            System.err.println("Error creating " + roots.jte() + ": " + e.getMessage());
            return 1;
        }
        System.out.println("[OK] JTE root ready: " + roots.jte());

        // 2) Drop the design tokens (idempotent: keep an existing file untouched).
        if (registry.find("tokens") != null) {
            List<FileCopy> tokens = CopyPlanner.plan(registry, List.of("tokens"), roots);
            for (FileCopy copy : tokens) {
                Path dest = projectDir.resolve(copy.dest());
                if (Files.exists(dest)) {
                    System.out.println("  keep  " + copy.dest() + " (already present)");
                    continue;
                }
                try {
                    AddCommand.writeFile(dest, copy.content());
                } catch (IOException e) {
                    System.err.println("Error writing " + copy.dest() + ": " + e.getMessage());
                    return 1;
                }
                System.out.println("  copy  " + copy.dest());
            }
            Registry.Item tok = registry.find("tokens");
            if (tok != null && !tok.docs().isBlank()) {
                System.out.println("note: tokens: " + tok.docs());
            }
        }

        System.out.println();
        System.out.println("Next steps:");
        System.out.println("  1. Import the tokens once from your global stylesheet.");
        System.out.println("  2. Add components:  lievit add button");
        System.out.println("  3. See upstream drift later with:  lievit diff button");
        return 0;
    }
}

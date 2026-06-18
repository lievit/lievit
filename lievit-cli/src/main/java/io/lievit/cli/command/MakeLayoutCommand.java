package io.lievit.cli.command;

import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;

/**
 * {@code lievit make:layout [name]} (Livewire {@code make:livewire --layout} / stub parity, issue
 * #141).
 *
 * <p>Scaffolds a JTE app layout under {@code src/main/jte/layouts/<name>.jte} (default {@code app})
 * with the lievit runtime asset directives in place: {@code <lievit:styles/>} in the head and
 * {@code <lievit:scripts/>} before the closing body (the runtime-bundle injection points, ADR-0061),
 * plus a {@code ${content}} slot for the rendered page. It is a one-shot generator (no class), the
 * recurring boilerplate every lievit app needs once.
 *
 * <p>Exit codes: 0 = created, 1 = the target file already exists or the project layout is missing.
 */
@Command(
    name = "make:layout",
    mixinStandardHelpOptions = true,
    description = "Scaffold a JTE app layout with the lievit asset directives and a content slot.",
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Layout created successfully.",
        " 1:Target file exists, or no src/main/java project layout was found."
    })
public class MakeLayoutCommand implements Callable<Integer> {

    @Parameters(
        index = "0",
        arity = "0..1",
        paramLabel = "[name]",
        description = "Layout name (kebab-case stem, default 'app').")
    String name = "app";

    private final Path workingDir;

    /** Production constructor: resolves against the process working directory. */
    public MakeLayoutCommand() {
        this(Path.of(System.getProperty("user.dir")));
    }

    /**
     * Test seam: resolve against an explicit working directory.
     *
     * @param workingDir the directory the command treats as the project root
     */
    public MakeLayoutCommand(Path workingDir) {
        this.workingDir = workingDir;
    }

    @Override
    public Integer call() {
        if (!Files.isDirectory(workingDir.resolve("src/main/java"))) {
            System.err.println("Error: no src/main/java found. Run this inside a lievit project.");
            return 1;
        }
        String stem = name == null || name.isBlank() ? "app" : name;
        Path layoutsDir = workingDir.resolve("src/main/jte/layouts");
        Path layoutFile = layoutsDir.resolve(stem + ".jte");
        if (Files.exists(layoutFile)) {
            System.err.println("Error: " + layoutFile + " already exists.");
            return 1;
        }
        try {
            Files.createDirectories(layoutsDir);
            Files.writeString(layoutFile, layout());
        } catch (IOException e) {
            System.err.println("Error creating layout: " + e.getMessage());
            return 1;
        }
        System.out.println("Created layout layouts/" + stem + ".jte");
        return 0;
    }

    private String layout() {
        return """
            @param String title = "lievit app"
            @param gg.jte.Content content

            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <lievit:styles/>
            </head>
            <body>
                ${content}
                <lievit:scripts/>
            </body>
            </html>
            """;
    }
}

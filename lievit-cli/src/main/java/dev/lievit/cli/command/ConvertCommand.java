package dev.lievit.cli.command;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.stream.Stream;

import dev.lievit.compiler.convert.ConversionWarning;
import dev.lievit.compiler.convert.ConvertResult;
import dev.lievit.compiler.convert.ViewConverter;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

/**
 * {@code lievit convert <Component>} (Livewire {@code livewire:convert} parity, issue #141).
 *
 * <p>Converts a component across the single-file (SFC) and multi-file (MFC) authoring boundary
 * (ADR-0003/0018): a single-file component (markup inline via the {@code dev.lievit.dsl.H} DSL in an
 * {@code @LievitRender Html view()}) becomes a class + a JTE template, and vice versa. The direction
 * is auto-detected from the component's current shape; the markup transform is the compiler's
 * engine-neutral view AST ({@code dev.lievit.compiler.convert}), so a round-trip is idempotent.
 *
 * <p>The convert is honest about what it cannot do: where a construct has no faithful equivalent (a
 * JTE {@code @if}/{@code @for} control block, a DSL {@code fragment(...)} root), it is
 * <strong>warn-and-skipped</strong>. By default a lossy convert is <em>refused</em> (exit 1, source
 * untouched) so work is never silently dropped; pass {@code --force} to write the partial result with
 * the warnings printed.
 *
 * <p>Exit codes: 0 = converted, 1 = component not found / lossy convert refused / IO error.
 */
@Command(
    name = "convert",
    mixinStandardHelpOptions = true,
    description = "Convert a component between single-file (DSL) and multi-file (class + JTE template).",
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Component converted successfully.",
        " 1:Component not found, lossy convert refused (use --force), or IO error."
    })
public class ConvertCommand implements Callable<Integer> {

    @Parameters(
        index = "0",
        paramLabel = "<Component>",
        description = "Component class name (PascalCase, e.g. Counter).")
    String name;

    @Option(
        names = "--force",
        description = "Write the converted output even when some constructs were warn-and-skipped.")
    boolean force;

    private final Path workingDir;
    private final ViewConverter converter = new ViewConverter();

    /** Production constructor: resolves against the process working directory. */
    public ConvertCommand() {
        this(Path.of(System.getProperty("user.dir")));
    }

    /**
     * Test seam: resolve against an explicit working directory.
     *
     * @param workingDir the directory the command treats as the project root
     */
    public ConvertCommand(Path workingDir) {
        this.workingDir = workingDir;
    }

    @Override
    public Integer call() {
        Path javaRoot = workingDir.resolve("src/main/java");
        if (!Files.isDirectory(javaRoot)) {
            System.err.println("Error: no src/main/java found. Run this inside a lievit project.");
            return 1;
        }
        Optional<Path> classFile = findClassFile(javaRoot, name + ".java");
        if (classFile.isEmpty()) {
            System.err.println("Error: component '" + name + "' not found under src/main/java.");
            return 1;
        }
        try {
            return convert(classFile.orElseThrow());
        } catch (IOException e) {
            System.err.println("Error converting component: " + e.getMessage());
            return 1;
        }
    }

    private Integer convert(Path classFile) throws IOException {
        String classSource = Files.readString(classFile);
        ViewConverter.Shape shape = converter.detectShape(classSource);

        return switch (shape) {
            case SINGLE_FILE -> toMultiFile(classFile, classSource);
            case MULTI_FILE -> toSingleFile(classFile, classSource);
            case UNKNOWN -> {
                System.err.println(
                        "Error: '" + name + "' is neither single-file (an @LievitRender Html view())"
                                + " nor multi-file (a template=...); nothing to convert.");
                yield 1;
            }
        };
    }

    private Integer toMultiFile(Path classFile, String classSource) throws IOException {
        ConvertResult result = converter.toMultiFile(classSource, name);
        if (result.template().isEmpty()) {
            System.err.println(
                    "Error: '" + name + "' has no convertible root markup; nothing was written"
                            + " (even with --force):");
            printWarnings(result.warnings());
            return 1;
        }
        if (!gateLossy(result)) {
            return 1;
        }
        Path templateFile = workingDir.resolve("src/main/jte").resolve(kebab(name) + ".jte");
        if (Files.exists(templateFile)) {
            System.err.println("Error: " + templateFile + " already exists; not overwriting.");
            return 1;
        }
        Files.createDirectories(templateFile.getParent());
        Files.writeString(templateFile, result.template().orElseThrow());
        Files.writeString(classFile, result.classSource());
        printWarnings(result.warnings());
        System.out.println(
                "Converted " + name + " to multi-file: " + classFile.getFileName() + " + template "
                        + kebab(name) + ".jte");
        return 0;
    }

    private Integer toSingleFile(Path classFile, String classSource) throws IOException {
        // The template id is the @LievitComponent(template = "..."); resolve its file under src/main/jte.
        String templateName = templateNameOf(classSource).orElse(kebab(name));
        Path templateFile = workingDir.resolve("src/main/jte").resolve(templateName + ".jte");
        if (!Files.isRegularFile(templateFile)) {
            System.err.println("Error: template " + templateFile + " not found for " + name + ".");
            return 1;
        }
        String templateSource = Files.readString(templateFile);
        ConvertResult result = converter.toSingleFile(classSource, templateSource);
        // No convertible root means the class was not rewritten; never delete the template then.
        if (result.classSource().equals(classSource)) {
            System.err.println(
                    "Error: template " + templateName + ".jte has no convertible root markup;"
                            + " nothing was written (even with --force):");
            printWarnings(result.warnings());
            return 1;
        }
        if (!gateLossy(result)) {
            return 1;
        }
        Files.writeString(classFile, result.classSource());
        Files.delete(templateFile);
        printWarnings(result.warnings());
        System.out.println(
                "Converted " + name + " to single-file: " + classFile.getFileName()
                        + " (template " + templateName + ".jte removed)");
        return 0;
    }

    /** Returns true to proceed; false (and prints) when the convert is lossy and {@code --force} is off. */
    private boolean gateLossy(ConvertResult result) {
        if (result.isFaithful() || force) {
            return true;
        }
        System.err.println(
                "Error: refusing a lossy convert of '" + name + "' (" + result.warnings().size()
                        + " construct(s) cannot be converted faithfully). Use --force to convert the"
                        + " safe parts and skip the rest:");
        printWarnings(result.warnings());
        return false;
    }

    private void printWarnings(List<ConversionWarning> warnings) {
        for (ConversionWarning w : warnings) {
            System.err.println("  WARN [" + w.construct() + "] " + w.detail());
        }
    }

    /** Reads the {@code template = "..."} value from a multi-file component's annotation. */
    private static Optional<String> templateNameOf(String classSource) {
        var m =
                java.util.regex.Pattern.compile(
                                "@LievitComponent\\s*\\(\\s*template\\s*=\\s*\"([^\"]*)\"")
                        .matcher(classSource);
        return m.find() ? Optional.of(m.group(1)) : Optional.empty();
    }

    /** Finds {@code <Name>.java} anywhere under {@code src/main/java}. */
    private static Optional<Path> findClassFile(Path javaRoot, String fileName) {
        try (Stream<Path> walk = Files.walk(javaRoot)) {
            return walk.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().equals(fileName))
                    .findFirst();
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    /** PascalCase -&gt; kebab-case (Counter -&gt; counter, UserList -&gt; user-list). */
    static String kebab(String pascal) {
        return pascal.replaceAll("([a-z0-9])([A-Z])", "$1-$2").toLowerCase();
    }
}

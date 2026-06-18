package io.lievit.cli.command;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;

import picocli.CommandLine.ArgGroup;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

/**
 * {@code lievit make:component <Name>}
 *
 * <p>Scaffolds a single {@code @LievitComponent} into the current project (Livewire
 * {@code make:livewire} parity, issue #141). It generates a Java component class with a sample
 * {@code @Wire} field and a {@code @LievitAction}, and, unless {@code --no-template} is passed, a
 * matching JTE template wired to the action. The default target is
 * {@code src/main/java/<package-as-path>/<Name>.java}; the package is inferred from the project
 * layout (the first package directory under {@code src/main/java}) or set with {@code --package}.
 *
 * <p>The IDE owns heavy scaffolding on the JVM (the README's "thin CLI" stance), so this is the one
 * recurring {@code make:*} that pays its way: a component is the unit a lievit app grows by, and the
 * Java class + template + action wiring is exactly the boilerplate worth a one-liner.
 *
 * <p>Exit codes: 0 = created, 1 = the target file already exists or the project layout is missing.
 */
@Command(
    name = "make:component",
    mixinStandardHelpOptions = true,
    description = "Scaffold a @LievitComponent (class + JTE template) into the current project.",
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Component created successfully.",
        " 1:Target file exists, or no src/main/java project layout was found."
    })
public class MakeComponentCommand implements Callable<Integer> {

    @Parameters(
        index = "0",
        paramLabel = "<Name>",
        description = "Component class name (PascalCase, e.g. Counter or UserList).")
    String name;

    @Option(
        names = {"-p", "--package"},
        paramLabel = "<package>",
        description = "Java package for the component (default: inferred from the project layout).")
    String packageName;

    @Option(
        names = "--no-template",
        description = "Generate only the Java class, not a JTE template (alias for --class).")
    boolean noTemplate;

    /** The authoring format (mutually exclusive). Defaults to multi-file when none is given. */
    @ArgGroup(exclusive = true)
    Format format = new Format();

    /** The {@code --sfc}/{@code --mfc}/{@code --class} format selectors (at most one). */
    static class Format {
        @Option(names = "--sfc", description = "Single-file: a class with an @LievitRender Html view() using the DSL.")
        boolean sfc;

        @Option(names = "--mfc", description = "Multi-file (default): a class + a separate JTE template.")
        boolean mfc;

        @Option(names = {"--class", "--class-based"}, description = "Class only: no template, no render method.")
        boolean classOnly;
    }

    @Option(names = "--test", description = "Also scaffold a colocated *Test.java unit test.")
    boolean withTest;

    @Option(names = "--js", description = "Also scaffold a colocated <Name>.lievit.ts client module.")
    boolean withJs;

    @Option(names = "--css", description = "Also scaffold a colocated <Name>.lievit.css scoped style.")
    boolean withCss;

    private final Path workingDir;

    /** Production constructor: resolves against the process working directory. */
    public MakeComponentCommand() {
        this(Path.of(System.getProperty("user.dir")));
    }

    /**
     * Test seam: resolve against an explicit working directory.
     *
     * @param workingDir the directory the command treats as the project root
     */
    public MakeComponentCommand(Path workingDir) {
        this.workingDir = workingDir;
    }

    @Override
    public Integer call() {
        if (!isValidClassName(name)) {
            System.err.println("Error: '" + name + "' is not a valid component class name (PascalCase).");
            return 1;
        }
        Path javaRoot = workingDir.resolve("src/main/java");
        if (!Files.isDirectory(javaRoot)) {
            System.err.println("Error: no src/main/java found. Run this inside a lievit project.");
            return 1;
        }
        String pkg = packageName != null && !packageName.isBlank() ? packageName : inferPackage(javaRoot);
        Path pkgDir = pkg.isEmpty() ? javaRoot : javaRoot.resolve(pkg.replace('.', '/'));
        Path classFile = pkgDir.resolve(name + ".java");
        if (Files.exists(classFile)) {
            System.err.println("Error: " + classFile + " already exists.");
            return 1;
        }
        Kind kind = resolveKind();
        try {
            Files.createDirectories(pkgDir);
            Files.writeString(classFile, classSource(pkg, name, kind));
            if (kind == Kind.MULTI_FILE) {
                Path templatesDir = workingDir.resolve("src/main/jte");
                Files.createDirectories(templatesDir);
                Path templateFile = templatesDir.resolve(kebab(name) + ".jte");
                if (!Files.exists(templateFile)) {
                    Files.writeString(templateFile, template(name));
                }
            }
            writeSiblings(javaRoot, pkg, pkgDir, name);
        } catch (IOException e) {
            System.err.println("Error creating component: " + e.getMessage());
            return 1;
        }
        System.out.println("Created " + kind.label + " component "
                + (pkg.isEmpty() ? name : pkg + "." + name)
                + (kind == Kind.MULTI_FILE ? " + template " + kebab(name) + ".jte" : "")
                + siblingSummary());
        return 0;
    }

    /** The three authoring kinds the command can scaffold. */
    private enum Kind {
        SINGLE_FILE("single-file"),
        MULTI_FILE("multi-file"),
        CLASS_ONLY("class-only");

        final String label;

        Kind(String label) {
            this.label = label;
        }
    }

    /** Resolves the requested kind from the format flags (multi-file is the default). */
    private Kind resolveKind() {
        if (format.sfc) {
            return Kind.SINGLE_FILE;
        }
        if (format.classOnly || noTemplate) {
            return Kind.CLASS_ONLY;
        }
        return Kind.MULTI_FILE;
    }

    /** Writes the requested colocated siblings (test / js / css), skipping any that already exist. */
    private void writeSiblings(Path javaRoot, String pkg, Path pkgDir, String className)
            throws IOException {
        if (withTest) {
            Path testPkgDir =
                    pkg.isEmpty()
                            ? workingDir.resolve("src/test/java")
                            : workingDir.resolve("src/test/java").resolve(pkg.replace('.', '/'));
            Files.createDirectories(testPkgDir);
            Path testFile = testPkgDir.resolve(className + "Test.java");
            if (!Files.exists(testFile)) {
                Files.writeString(testFile, testSource(pkg, className));
            }
        }
        if (withJs) {
            Path js = pkgDir.resolve(className + ".lievit.ts");
            if (!Files.exists(js)) {
                Files.writeString(js, jsModule(className));
            }
        }
        if (withCss) {
            Path css = pkgDir.resolve(className + ".lievit.css");
            if (!Files.exists(css)) {
                Files.writeString(css, cssModule());
            }
        }
    }

    private String siblingSummary() {
        StringBuilder s = new StringBuilder();
        if (withTest) {
            s.append(" + test");
        }
        if (withJs) {
            s.append(" + js");
        }
        if (withCss) {
            s.append(" + css");
        }
        return s.toString();
    }

    /** A valid component name is a PascalCase Java identifier. */
    public boolean isValidClassName(String candidate) {
        return candidate != null && candidate.matches("[A-Z][A-Za-z0-9_]*");
    }

    /**
     * Infers the project package: the deepest single-chain package directory under
     * {@code src/main/java} (the common case of one root package), else the empty (default) package.
     *
     * @param javaRoot the {@code src/main/java} directory
     * @return the inferred dotted package, or {@code ""} when none can be inferred
     */
    public String inferPackage(Path javaRoot) {
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

    /** PascalCase -> kebab-case (Counter -> counter, UserList -> user-list). */
    public String kebab(String pascal) {
        return pascal.replaceAll("([a-z0-9])([A-Z])", "$1-$2").toLowerCase();
    }

    private String classSource(String pkg, String className, Kind kind) {
        return switch (kind) {
            case MULTI_FILE -> multiFileClass(pkg, className);
            case CLASS_ONLY -> classOnly(pkg, className);
            case SINGLE_FILE -> singleFileClass(pkg, className);
        };
    }

    private String multiFileClass(String pkg, String className) {
        String packageLine = pkg.isEmpty() ? "" : "package " + pkg + ";\n\n";
        return packageLine + """
            import io.lievit.LievitAction;
            import io.lievit.LievitComponent;
            import io.lievit.Wire;

            /**
             * The %s lievit component.
             *
             * <p>Render its template (%s.jte) and drive it over the wire: the @Wire field stays in
             * sync between server and browser, the @LievitAction is callable from the template.
             */
            @LievitComponent(template = "%s")
            public class %s {

                @Wire
                int count = 0;

                @LievitAction
                public void increment() {
                    count++;
                }
            }
            """.formatted(className, kebab(className), kebab(className), className);
    }

    private String classOnly(String pkg, String className) {
        String packageLine = pkg.isEmpty() ? "" : "package " + pkg + ";\n\n";
        return packageLine + """
            import io.lievit.LievitAction;
            import io.lievit.LievitComponent;
            import io.lievit.Wire;

            /**
             * The %s lievit component (class only; add a template via @LievitComponent(template=...)
             * for multi-file, or a render method for single-file mode).
             *
             * <p>The @Wire field stays in sync between server and browser; the @LievitAction is
             * callable from the markup.
             */
            @LievitComponent
            public class %s {

                @Wire
                int count = 0;

                @LievitAction
                public void increment() {
                    count++;
                }
            }
            """.formatted(className, className);
    }

    private String singleFileClass(String pkg, String className) {
        String packageLine = pkg.isEmpty() ? "" : "package " + pkg + ";\n\n";
        return packageLine + """
            import static io.lievit.dsl.H.*;

            import io.lievit.LievitAction;
            import io.lievit.LievitComponent;
            import io.lievit.LievitRender;
            import io.lievit.Wire;
            import io.lievit.dsl.Html;

            /**
             * The %s lievit component (single-file: the markup is the type-safe DSL tree returned by
             * view(), ADR-0018; no separate template). The @Wire field stays in sync over the wire and
             * the @LievitAction is callable from the markup.
             */
            @LievitComponent
            public class %s {

                @Wire
                int count = 0;

                @LievitAction
                public void increment() {
                    count++;
                }

                @LievitRender
                Html view() {
                    return div(
                            span(text(count)),
                            button(text("+")).wireClick("increment"));
                }
            }
            """.formatted(className, className);
    }

    private String testSource(String pkg, String className) {
        String packageLine = pkg.isEmpty() ? "" : "package " + pkg + ";\n\n";
        return packageLine + """
            import static org.assertj.core.api.Assertions.assertThat;

            import org.junit.jupiter.api.Test;

            /**
             * Unit spec for the {@link %s} component. Drives its actions directly (no Spring) and
             * asserts the resulting @Wire state, the fast pure-domain loop.
             */
            class %sTest {

                /**
                 * @spec.given a freshly constructed %s
                 * @spec.when  increment() is invoked
                 * @spec.then  the count advances by one
                 */
                @Test
                void increment_advances_the_count() {
                    %s component = new %s();
                    component.increment();
                    assertThat(component.count).isEqualTo(1);
                }
            }
            """.formatted(className, className, className, className, className);
    }

    private String jsModule(String className) {
        return """
            // Colocated client module for the %s component (loaded under the strict CSP, ADR-0062).
            // Page behaviour lives here, never in an inline <script>. Exported run() receives the
            // component's $wire handle when the component mounts.
            export function run($wire: unknown): void {
                // Wire up client-only behaviour here (focus, transitions, third-party widgets).
            }
            """.formatted(className);
    }

    private String cssModule() {
        return """
            /* Colocated scoped style for this component (served on a CSP-safe route, ADR-0063). */
            :host {
                display: block;
            }
            """;
    }

    private String template(String className) {
        return """
            @param int count

            <div>
                <span>Count: ${count}</span>
                <button l:click="increment">+</button>
            </div>
            """;
    }
}

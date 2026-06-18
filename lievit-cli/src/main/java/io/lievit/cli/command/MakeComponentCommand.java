package io.lievit.cli.command;

import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;

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
        description = "Generate only the Java class, not a JTE template.")
    boolean noTemplate;

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
        try {
            Files.createDirectories(pkgDir);
            Files.writeString(classFile, componentClass(pkg, name));
            if (!noTemplate) {
                Path templatesDir = workingDir.resolve("src/main/jte");
                Files.createDirectories(templatesDir);
                Path templateFile = templatesDir.resolve(kebab(name) + ".jte");
                if (!Files.exists(templateFile)) {
                    Files.writeString(templateFile, template(name));
                }
            }
        } catch (IOException e) {
            System.err.println("Error creating component: " + e.getMessage());
            return 1;
        }
        System.out.println("Created component " + (pkg.isEmpty() ? name : pkg + "." + name)
                + (noTemplate ? "" : " + template " + kebab(name) + ".jte"));
        return 0;
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

    private String componentClass(String pkg, String className) {
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
            @LievitComponent
            public class %s {

                @Wire
                int count = 0;

                @LievitAction
                public void increment() {
                    count++;
                }
            }
            """.formatted(className, kebab(className), className);
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

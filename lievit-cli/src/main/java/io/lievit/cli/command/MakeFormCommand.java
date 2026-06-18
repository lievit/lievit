package io.lievit.cli.command;

import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;

/**
 * {@code lievit make:form <Name>} (Livewire {@code make:livewire --form} family parity, issue #141).
 *
 * <p>Scaffolds a form component: a {@code @LievitComponent} class with two sample {@code @Wire}
 * fields, an {@code @LievitAction save()} that is the submit handler, and a matching JTE template
 * whose {@code <form>} wires {@code l:submit="save"} and binds the fields with {@code l:model}. It is
 * the recurring "a form is a component with fields + a save action" boilerplate, the lievit analogue
 * of Livewire's form-object scaffold, mapped onto a single server-rendered component (no React, the
 * repo stance).
 *
 * <p>Exit codes: 0 = created, 1 = the target file already exists or the project layout is missing.
 */
@Command(
    name = "make:form",
    mixinStandardHelpOptions = true,
    description = "Scaffold a form component (class with @Wire fields + save action) + JTE template.",
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Form created successfully.",
        " 1:Target file exists, or no src/main/java project layout was found."
    })
public class MakeFormCommand implements Callable<Integer> {

    @Parameters(
        index = "0",
        paramLabel = "<Name>",
        description = "Form component class name (PascalCase, e.g. ContactForm).")
    String name;

    @Option(
        names = {"-p", "--package"},
        paramLabel = "<package>",
        description = "Java package for the component (default: inferred from the project layout).")
    String packageName;

    private final Path workingDir;

    /** Production constructor: resolves against the process working directory. */
    public MakeFormCommand() {
        this(Path.of(System.getProperty("user.dir")));
    }

    /**
     * Test seam: resolve against an explicit working directory.
     *
     * @param workingDir the directory the command treats as the project root
     */
    public MakeFormCommand(Path workingDir) {
        this.workingDir = workingDir;
    }

    @Override
    public Integer call() {
        Scaffolds scaffolds = new Scaffolds(workingDir);
        if (!scaffolds.isValidClassName(name)) {
            System.err.println("Error: '" + name + "' is not a valid component class name (PascalCase).");
            return 1;
        }
        Path javaRoot = workingDir.resolve("src/main/java");
        if (!Files.isDirectory(javaRoot)) {
            System.err.println("Error: no src/main/java found. Run this inside a lievit project.");
            return 1;
        }
        String pkg = packageName != null && !packageName.isBlank() ? packageName : scaffolds.inferPackage(javaRoot);
        Path pkgDir = pkg.isEmpty() ? javaRoot : javaRoot.resolve(pkg.replace('.', '/'));
        Path classFile = pkgDir.resolve(name + ".java");
        if (Files.exists(classFile)) {
            System.err.println("Error: " + classFile + " already exists.");
            return 1;
        }
        try {
            Files.createDirectories(pkgDir);
            Files.writeString(classFile, formClass(pkg, name));
            Path templatesDir = workingDir.resolve("src/main/jte");
            Files.createDirectories(templatesDir);
            Path templateFile = templatesDir.resolve(Scaffolds.kebab(name) + ".jte");
            if (!Files.exists(templateFile)) {
                Files.writeString(templateFile, formTemplate());
            }
        } catch (IOException e) {
            System.err.println("Error creating form: " + e.getMessage());
            return 1;
        }
        System.out.println("Created form " + (pkg.isEmpty() ? name : pkg + "." + name)
                + " + template " + Scaffolds.kebab(name) + ".jte");
        return 0;
    }

    private String formClass(String pkg, String className) {
        String packageLine = pkg.isEmpty() ? "" : "package " + pkg + ";\n\n";
        return packageLine + """
            import io.lievit.LievitAction;
            import io.lievit.LievitComponent;
            import io.lievit.Wire;

            /**
             * The %s form component. The @Wire fields two-way bind to the template inputs via
             * l:model; save() is the l:submit handler. Validate the fields in save() before
             * persisting, and surface errors back through @Wire state (server is the source of truth).
             */
            @LievitComponent(template = "%s")
            public class %s {

                @Wire
                String name = "";

                @Wire
                String email = "";

                @Wire
                String error = "";

                @LievitAction
                void save() {
                    if (name.isBlank() || email.isBlank()) {
                        error = "Name and email are required.";
                        return;
                    }
                    error = "";
                    // TODO: persist the submitted values, then redirect or reset.
                }
            }
            """.formatted(className, Scaffolds.kebab(className), className);
    }

    private String formTemplate() {
        return """
            @param String name
            @param String email
            @param String error

            <form l:submit="save">
                <label>
                    Name
                    <input type="text" l:model="name" value="${name}">
                </label>
                <label>
                    Email
                    <input type="email" l:model="email" value="${email}">
                </label>
                <p>${error}</p>
                <button type="submit">Save</button>
            </form>
            """;
    }
}

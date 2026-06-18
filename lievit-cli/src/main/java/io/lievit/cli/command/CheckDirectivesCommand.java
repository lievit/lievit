package io.lievit.cli.command;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.stream.Stream;

import io.lievit.compiler.DirectiveValidator;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

/**
 * {@code lievit check-directives <dir>} — the true COMPILE-TIME half of the unknown-{@code l:}-directive
 * poka-yoke (ADR-0082).
 *
 * <p>The starter's {@code DirectiveTemplateValidator} fails fast at <em>startup</em> by scanning
 * {@code classpath*:jte/**}{@code /*.jte}. That scan is INERT for an adopter that PRECOMPILES its JTE
 * templates: the {@code .jte} <em>source</em> lives under {@code src/main/jte} and is compiled into the
 * jar, so it is not on the runtime classpath as {@code .jte} and the startup scan finds nothing. This
 * command closes that gap: it walks the adopter's SOURCE template directory at THEIR build time, runs
 * the exact same {@link DirectiveValidator}, and exits non-zero on the first unknown directive, so the
 * failure lands in the build (where the source exists), not silently in the browser.
 *
 * <p>It reuses {@link DirectiveValidator}/{@code DirectiveNames} unchanged: same valid-directive set,
 * same {@code file:line} + {@code $set} hint message as the startup bean. The {@code --extra} allowlist
 * mirrors {@code lievit.directives.extra} for app-registered custom directives a static scan cannot see.
 *
 * <p>Adopter wiring (the tracegate-style "consume a pinned tool" model): run it over the source
 * template tree in the build, e.g. for a monorepo app whose templates live under
 * {@code apps/gest/src/main/jte}:
 *
 * <pre>{@code
 * java -jar lievit-cli-<ver>-cli-exec.jar check-directives apps/gest/src/main/jte
 * }</pre>
 *
 * <p>Exit codes: 0 = no unknown directives (or no templates found); 1 = at least one unknown directive;
 * 2 = the directory does not exist / is unreadable (usage error).
 */
@Command(
    name = "check-directives",
    mixinStandardHelpOptions = true,
    description = {
        "Validate l: directives in source .jte templates at build time (compile-time poka-yoke).",
        "",
        "Walks <dir> for *.jte source files and fails on any unknown l:<name> directive,",
        "with the same file:line + $set hint as the startup check. Use this in an adopter build",
        "whose templates are precompiled (so the runtime classpath scan is inert)."
    },
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:No unknown directives (or no templates found).",
        " 1:At least one unknown l: directive.",
        " 2:The directory does not exist or is unreadable."
    })
public class CheckDirectivesCommand implements Callable<Integer> {

    @Parameters(
        index = "0",
        paramLabel = "<dir>",
        description = "Directory to scan recursively for source .jte templates (e.g. src/main/jte).")
    Path dir;

    @Option(
        names = "--extra",
        paramLabel = "<name>",
        split = ",",
        description = {
            "Custom directive name(s) to allowlist, without the l: prefix (repeatable or comma-",
            "separated). Mirrors lievit.directives.extra for directives registered at runtime via",
            "runtime.directives.register, which a static scan cannot see."
        })
    List<String> extra = new ArrayList<>();

    @Option(
        names = "--glob",
        paramLabel = "<glob>",
        defaultValue = "*.jte",
        description = "Filename glob to match under <dir> (default: ${DEFAULT-VALUE}).")
    String glob;

    @Override
    public Integer call() {
        if (dir == null || !Files.isDirectory(dir)) {
            System.err.println("Error: not a directory: " + dir);
            return 2;
        }

        DirectiveValidator validator = new DirectiveValidator(new LinkedHashSet<>(extra));
        List<Path> templates;
        try {
            templates = findTemplates(dir, glob);
        } catch (UncheckedIOException e) {
            System.err.println("Error: could not walk " + dir + ": " + e.getCause().getMessage());
            return 2;
        }

        List<DirectiveValidator.Violation> violations = new ArrayList<>();
        for (Path template : templates) {
            String name = relativeName(dir, template);
            violations.addAll(validator.validate(name, read(template)));
        }

        if (violations.isEmpty()) {
            System.out.println(
                    "[OK]   lievit check-directives: " + templates.size()
                            + " template(s) scanned, no unknown l: directives.");
            return 0;
        }

        // De-duplicate identical lines (the same directive on the same line reported once).
        Set<String> lines = new LinkedHashSet<>();
        for (DirectiveValidator.Violation v : violations) {
            lines.add("  - " + v.message());
        }
        System.err.println(
                "[FAIL] lievit check-directives: " + violations.size()
                        + " unknown l: directive(s) (these would silently no-op in the browser):");
        lines.forEach(System.err::println);
        System.err.println(
                "Fix the template, or if a directive is registered at runtime via "
                        + "runtime.directives.register, allowlist its name with --extra=<name>.");
        return 1;
    }

    /** Walks {@code dir} for source templates matching {@code glob}, in stable (sorted) order. */
    private static List<Path> findTemplates(Path dir, String glob) {
        var matcher = dir.getFileSystem().getPathMatcher("glob:" + glob);
        try (Stream<Path> walk = Files.walk(dir)) {
            return walk.filter(Files::isRegularFile)
                    .filter(p -> matcher.matches(p.getFileName()))
                    .sorted()
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String read(Path template) {
        try {
            return Files.readString(template, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("failed reading template " + template, e);
        }
    }

    /** The template name relative to the scanned root, for a readable error message. */
    private static String relativeName(Path root, Path template) {
        return root.relativize(template).toString().replace('\\', '/');
    }
}

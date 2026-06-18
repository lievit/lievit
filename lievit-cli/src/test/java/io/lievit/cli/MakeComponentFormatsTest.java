package io.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import io.lievit.cli.command.MakeComponentCommand;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import picocli.CommandLine;

/**
 * Spec for the {@code make:component} authoring-format flags and sibling generators (issue #141,
 * ADR-0073): {@code --sfc} scaffolds a single-file DSL component (no template, an {@code @LievitRender
 * Html view()}), {@code --mfc} (the default) a class + JTE template, {@code --class} a class with no
 * markup, and {@code --test}/{@code --js}/{@code --css} add the colocated siblings. The kebab name
 * normalization and no-overwrite behaviour from the base command still hold.
 */
class MakeComponentFormatsTest {

    /**
     * @spec.given a project and the --sfc flag
     * @spec.when  make:component Counter --sfc is invoked
     * @spec.then  a single-file class is written (DSL imports, @LievitRender Html view(), no template
     *     attribute) and no JTE template is created
     */
    @Test
    void sfc_scaffolds_a_single_file_dsl_component(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java/com/example/app"));

        int exit = new CommandLine(new MakeComponentCommand(project)).execute("Counter", "--sfc");

        assertThat(exit).isZero();
        String src = Files.readString(project.resolve("src/main/java/com/example/app/Counter.java"));
        assertThat(src).contains("import static io.lievit.dsl.H.*;");
        assertThat(src).contains("Html view()");
        assertThat(src).doesNotContain("template =");
        assertThat(project.resolve("src/main/jte/counter.jte")).doesNotExist();
    }

    /**
     * @spec.given a project and the --class flag
     * @spec.when  make:component Counter --class is invoked
     * @spec.then  only a class is written, with neither a template nor a render method
     */
    @Test
    void class_scaffolds_only_a_class(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java/com/example/app"));

        int exit = new CommandLine(new MakeComponentCommand(project)).execute("Counter", "--class");

        assertThat(exit).isZero();
        String src = Files.readString(project.resolve("src/main/java/com/example/app/Counter.java"));
        assertThat(src).contains("@LievitComponent");
        assertThat(src).doesNotContain("@LievitRender");
        assertThat(project.resolve("src/main/jte/counter.jte")).doesNotExist();
    }

    /**
     * @spec.given a project and --mfc with --test --js --css siblings
     * @spec.when  make:component Counter is invoked
     * @spec.then  the class + template + a *Test.java + the colocated .lievit.ts and .lievit.css are
     *     all written
     */
    @Test
    void mfc_with_siblings_scaffolds_test_js_and_css(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java/com/example/app"));

        int exit =
                new CommandLine(new MakeComponentCommand(project))
                        .execute("Counter", "--mfc", "--test", "--js", "--css");

        assertThat(exit).isZero();
        assertThat(project.resolve("src/main/java/com/example/app/Counter.java")).isRegularFile();
        assertThat(project.resolve("src/main/jte/counter.jte")).isRegularFile();
        assertThat(project.resolve("src/test/java/com/example/app/CounterTest.java")).isRegularFile();
        assertThat(project.resolve("src/main/java/com/example/app/Counter.lievit.ts")).isRegularFile();
        assertThat(project.resolve("src/main/java/com/example/app/Counter.lievit.css")).isRegularFile();
    }

    /**
     * @spec.given both --sfc and --mfc passed together (mutually exclusive)
     * @spec.when  the command runs
     * @spec.then  it exits 2 (usage error) rather than guessing a format
     */
    @Test
    void sfc_and_mfc_are_mutually_exclusive(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java"));
        int exit = new CommandLine(new MakeComponentCommand(project)).execute("Counter", "--sfc", "--mfc");
        assertThat(exit).isEqualTo(2);
    }
}

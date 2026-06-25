package dev.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import dev.lievit.cli.command.ConvertCommand;
import picocli.CommandLine;

/**
 * Spec for {@code lievit convert <Component>} (issue #141, ADR-0074): the command detects the
 * authoring shape of a component, converts it across the SFC&lt;-&gt;MFC boundary through the
 * compiler's view AST, writes the rewritten class (and the template, or removes it), and refuses to
 * silently destroy work it cannot convert. It is the Livewire {@code livewire:convert} analogue.
 */
class ConvertCommandTest {

    private static final String SFC =
            """
            package com.example.app;

            import static dev.lievit.dsl.H.*;

            import dev.lievit.LievitAction;
            import dev.lievit.LievitComponent;
            import dev.lievit.LievitRender;
            import dev.lievit.Wire;
            import dev.lievit.dsl.Html;

            @LievitComponent
            public class Counter {

                @Wire int count;

                @LievitAction
                void increment() {
                    count++;
                }

                @LievitRender
                Html view() {
                    return div(span(text(count)), button(text("+")).wireClick("increment"));
                }
            }
            """;

    private Path writeComponent(Path project, String src) throws IOException {
        Path pkg = project.resolve("src/main/java/com/example/app");
        Files.createDirectories(pkg);
        Path file = pkg.resolve("Counter.java");
        Files.writeString(file, src);
        return file;
    }

    /**
     * @spec.given a single-file Counter on disk
     * @spec.when  convert Counter is invoked (auto-detects single-file -> multi-file)
     * @spec.then  exits 0, the class now declares a template and drops the render method, and a JTE
     *     template is written under src/main/jte
     */
    @Test
    void converts_single_file_to_multi_file_and_writes_template(@TempDir Path project)
            throws IOException {
        writeComponent(project, SFC);

        int exit = new CommandLine(new ConvertCommand(project)).execute("Counter");

        assertThat(exit).isZero();
        String src = Files.readString(project.resolve("src/main/java/com/example/app/Counter.java"));
        assertThat(src).contains("@LievitComponent(template = \"counter\")");
        assertThat(src).doesNotContain("@LievitRender");
        Path template = project.resolve("src/main/jte/counter.jte");
        assertThat(template).isRegularFile();
        assertThat(Files.readString(template)).contains("l:click=\"increment\"");
    }

    /**
     * @spec.given a multi-file Counter (class + template) on disk
     * @spec.when  convert Counter is invoked (auto-detects multi-file -> single-file)
     * @spec.then  exits 0, the class regains an @LievitRender Html view(), and the JTE template is
     *     deleted (single-file colocates the markup)
     */
    @Test
    void converts_multi_file_to_single_file_and_removes_template(@TempDir Path project)
            throws IOException {
        // first produce a multi-file Counter by converting the SFC, then convert back
        writeComponent(project, SFC);
        new CommandLine(new ConvertCommand(project)).execute("Counter");

        int exit = new CommandLine(new ConvertCommand(project)).execute("Counter");

        assertThat(exit).isZero();
        String src = Files.readString(project.resolve("src/main/java/com/example/app/Counter.java"));
        assertThat(src).contains("Html view()");
        assertThat(src).contains("import static dev.lievit.dsl.H.*;");
        assertThat(project.resolve("src/main/jte/counter.jte")).doesNotExist();
    }

    /**
     * @spec.given a component that does not exist
     * @spec.when  convert is invoked for it
     * @spec.then  exits 1 (not found) without writing anything
     */
    @Test
    void missing_component_fails_with_exit_1(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java"));
        int exit = new CommandLine(new ConvertCommand(project)).execute("Ghost");
        assertThat(exit).isEqualTo(1);
    }

    /**
     * @spec.given a single-file component whose render uses a fragment root (cannot convert faithfully)
     * @spec.when  convert is invoked without --force
     * @spec.then  exits 1, reports the warn-and-skip, and leaves the source untouched
     */
    @Test
    void refuses_a_lossy_convert_without_force(@TempDir Path project) throws IOException {
        String lossy =
                SFC.replace(
                        "return div(span(text(count)), button(text(\"+\")).wireClick(\"increment\"));",
                        "return fragment(div(text(count)), div(text(count)));");
        writeComponent(project, lossy);

        int exit = new CommandLine(new ConvertCommand(project)).execute("Counter");

        assertThat(exit).isEqualTo(1);
        // source untouched: still single-file
        assertThat(Files.readString(project.resolve("src/main/java/com/example/app/Counter.java")))
                .contains("@LievitRender");
    }

    /**
     * @spec.given a single-file component with an unconvertible root, converted with --force
     * @spec.when  convert --force is invoked
     * @spec.then  it still exits 1 and writes no template, because there is no convertible root markup
     *     to write at all (force converts the safe parts, it cannot invent a root)
     */
    @Test
    void force_cannot_write_when_there_is_no_convertible_root(@TempDir Path project)
            throws IOException {
        String lossy =
                SFC.replace(
                        "return div(span(text(count)), button(text(\"+\")).wireClick(\"increment\"));",
                        "return fragment(div(text(count)), div(text(count)));");
        writeComponent(project, lossy);

        int exit = new CommandLine(new ConvertCommand(project)).execute("Counter", "--force");

        assertThat(exit).isEqualTo(1);
        assertThat(project.resolve("src/main/jte/counter.jte")).doesNotExist();
    }
}

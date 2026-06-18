package io.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import io.lievit.cli.command.MakeLayoutCommand;
import picocli.CommandLine;

/**
 * Spec for {@code lievit make:layout [name]} (Livewire {@code make:livewire --layout} / stub parity,
 * issue #141): scaffolds a JTE app layout under {@code src/main/jte} with the lievit asset directives
 * ({@code <lievit:styles/>} / {@code <lievit:scripts/>}) and a content slot, no-overwrite.
 */
class MakeLayoutCommandTest {

    /**
     * @spec.given a project
     * @spec.when  make:layout is invoked with no name
     * @spec.then  src/main/jte/layouts/app.jte is written with the asset directives and a content slot
     */
    @Test
    void scaffolds_the_default_app_layout(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java"));

        int exit = new CommandLine(new MakeLayoutCommand(project)).execute();

        assertThat(exit).isZero();
        Path layout = project.resolve("src/main/jte/layouts/app.jte");
        assertThat(layout).isRegularFile();
        String src = Files.readString(layout);
        assertThat(src).contains("<lievit:styles/>");
        assertThat(src).contains("<lievit:scripts/>");
        assertThat(src).contains("${content}");
    }

    /**
     * @spec.given an explicit layout name
     * @spec.when  make:layout admin is invoked
     * @spec.then  src/main/jte/layouts/admin.jte is written
     */
    @Test
    void scaffolds_a_named_layout(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java"));

        int exit = new CommandLine(new MakeLayoutCommand(project)).execute("admin");

        assertThat(exit).isZero();
        assertThat(project.resolve("src/main/jte/layouts/admin.jte")).isRegularFile();
    }

    /**
     * @spec.given an existing layout file
     * @spec.when  make:layout is invoked for the same name
     * @spec.then  exits 1 without overwriting
     */
    @Test
    void existing_layout_fails_with_exit_1(@TempDir Path project) throws IOException {
        Path layouts = project.resolve("src/main/jte/layouts");
        Files.createDirectories(layouts);
        Files.writeString(layouts.resolve("app.jte"), "existing");

        int exit = new CommandLine(new MakeLayoutCommand(project)).execute();

        assertThat(exit).isEqualTo(1);
        assertThat(Files.readString(layouts.resolve("app.jte"))).isEqualTo("existing");
    }
}

package dev.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import dev.lievit.cli.command.MakeComponentCommand;
import picocli.CommandLine;

/**
 * Unit tests for {@code lievit make:component <Name>} (Livewire make parity, #141).
 */
class MakeComponentCommandTest {

    /**
     * @spec.given a project with a single root package under src/main/java
     * @spec.when make:component is invoked with a PascalCase name
     * @spec.then exits 0 and writes the component class into the inferred package + a JTE template
     */
    @Test
    void creates_component_class_and_template_in_inferred_package(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java/com/example/app"));

        int exit = new CommandLine(new MakeComponentCommand(project)).execute("Counter");

        assertThat(exit).isZero();
        Path classFile = project.resolve("src/main/java/com/example/app/Counter.java");
        assertThat(classFile).isRegularFile();
        String src = Files.readString(classFile);
        assertThat(src).contains("package com.example.app;");
        assertThat(src).contains("@LievitComponent");
        assertThat(src).contains("@LievitAction");
        assertThat(src).contains("public class Counter");
        Path template = project.resolve("src/main/jte/counter.jte");
        assertThat(template).isRegularFile();
        assertThat(Files.readString(template)).contains("l:click=\"increment\"");
    }

    /**
     * @spec.given an explicit --package override and --no-template
     * @spec.when make:component is invoked
     * @spec.then the class lands in the given package and no template is written
     */
    @Test
    void honours_explicit_package_and_no_template(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java"));

        int exit = new CommandLine(new MakeComponentCommand(project))
                .execute("UserList", "--package", "io.shop.users", "--no-template");

        assertThat(exit).isZero();
        assertThat(project.resolve("src/main/java/io/shop/users/UserList.java")).isRegularFile();
        assertThat(project.resolve("src/main/jte/user-list.jte")).doesNotExist();
    }

    /**
     * @spec.given a component class that already exists
     * @spec.when make:component is invoked with the same name
     * @spec.then exits 1 without overwriting
     */
    @Test
    void existing_class_fails_with_exit_1(@TempDir Path project) throws IOException {
        Path pkg = project.resolve("src/main/java/com/example/app");
        Files.createDirectories(pkg);
        Files.writeString(pkg.resolve("Counter.java"), "// existing");

        int exit = new CommandLine(new MakeComponentCommand(project)).execute("Counter");

        assertThat(exit).isEqualTo(1);
        assertThat(Files.readString(pkg.resolve("Counter.java"))).isEqualTo("// existing");
    }

    /**
     * @spec.given a working directory with no src/main/java layout
     * @spec.when make:component is invoked
     * @spec.then exits 1 (not a lievit project)
     */
    @Test
    void missing_project_layout_fails_with_exit_1(@TempDir Path project) {
        int exit = new CommandLine(new MakeComponentCommand(project)).execute("Counter");
        assertThat(exit).isEqualTo(1);
    }

    /**
     * @spec.given a lower-case (non-PascalCase) name
     * @spec.when isValidClassName is checked and the command runs
     * @spec.then the name is rejected and the command exits 1
     */
    @Test
    void rejects_a_non_pascal_case_name(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java"));
        MakeComponentCommand cmd = new MakeComponentCommand(project);
        assertThat(cmd.isValidClassName("counter")).isFalse();
        assertThat(cmd.isValidClassName("Counter")).isTrue();
        assertThat(new CommandLine(cmd).execute("counter")).isEqualTo(1);
    }

    /**
     * @spec.given PascalCase component names
     * @spec.when kebab is called
     * @spec.then they convert to kebab-case template file stems
     */
    @Test
    void converts_pascal_case_to_kebab_case() {
        MakeComponentCommand cmd = new MakeComponentCommand(Path.of("."));
        assertThat(cmd.kebab("Counter")).isEqualTo("counter");
        assertThat(cmd.kebab("UserList")).isEqualTo("user-list");
    }
}

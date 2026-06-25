package dev.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import dev.lievit.cli.command.AddCommand;
import dev.lievit.cli.command.DiffCommand;
import picocli.CommandLine;

/**
 * CLI tests for {@code lievit diff}: detecting upstream drift on a copied-in component. A component
 * is first copied with {@code add}, then mutated locally, and {@code diff} must surface the change.
 */
class DiffCommandTest {

    private static Result run(Object command, String... args) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        PrintStream savedOut = System.out;
        PrintStream savedErr = System.err;
        System.setOut(new PrintStream(out, true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(err, true, StandardCharsets.UTF_8));
        try {
            int code = new CommandLine(command).execute(args);
            return new Result(
                    code, out.toString(StandardCharsets.UTF_8), err.toString(StandardCharsets.UTF_8));
        } finally {
            System.setOut(savedOut);
            System.setErr(savedErr);
        }
    }

    private record Result(int exitCode, String stdout, String stderr) {}

    /**
     * @spec.given a button copied in then edited locally
     * @spec.when `lievit diff button` runs
     * @spec.then it exits 1 and prints a unified diff with the local line removed
     */
    @Test
    void diff_detects_a_modified_local_copy(@TempDir Path project) throws Exception {
        new CommandLine(new AddCommand(project, CopyInFixtures.registry())).execute("button");
        Path button = project.resolve("src/main/jte/lievit/button.jte");
        Files.writeString(button, CopyInFixtures.BUTTON_CONTENT + "<!-- my local tweak -->\n");

        Result r = run(new DiffCommand(project, CopyInFixtures.registry()), "button");

        assertThat(r.exitCode()).isEqualTo(1);
        assertThat(r.stdout())
                .contains("--- a/src/main/jte/lievit/button.jte")
                .contains("-<!-- my local tweak -->");
    }

    /**
     * @spec.given a button copied in and left untouched
     * @spec.when `lievit diff button` runs
     * @spec.then it exits 0 and reports the local copies match the registry
     */
    @Test
    void diff_on_a_clean_copy_exits_zero(@TempDir Path project) {
        new CommandLine(new AddCommand(project, CopyInFixtures.registry())).execute("button");

        Result r = run(new DiffCommand(project, CopyInFixtures.registry()), "button");

        assertThat(r.exitCode()).isZero();
        assertThat(r.stdout()).contains("identical to the registry");
    }

    /**
     * @spec.given a component never copied locally
     * @spec.when `lievit diff button` runs
     * @spec.then it exits 1 noting the file is not copied locally
     */
    @Test
    void diff_on_a_missing_local_copy_exits_one(@TempDir Path project) {
        Result r = run(new DiffCommand(project, CopyInFixtures.registry()), "button");

        assertThat(r.exitCode()).isEqualTo(1);
        assertThat(r.stdout()).contains("not copied locally");
    }

    /**
     * @spec.given an unknown component name
     * @spec.when `lievit diff` is asked for it
     * @spec.then it exits 2 (usage error)
     */
    @Test
    void diff_unknown_component_exits_two(@TempDir Path project) {
        Result r = run(new DiffCommand(project, CopyInFixtures.registry()), "nope");

        assertThat(r.exitCode()).isEqualTo(2);
        assertThat(r.stderr()).contains("unknown registry item: nope");
    }
}

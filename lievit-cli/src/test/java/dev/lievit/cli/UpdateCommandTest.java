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
import dev.lievit.cli.command.UpdateCommand;
import picocli.CommandLine;

/**
 * CLI tests for {@code lievit update}: re-copying the registry source over a drifted local copy.
 */
class UpdateCommandTest {

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

    private static String read(Path p) throws Exception {
        return Files.readString(p, StandardCharsets.UTF_8);
    }

    /**
     * @spec.given a button copied in then edited locally
     * @spec.when `lievit update button` runs
     * @spec.then the registry content is restored over the local copy and the loss is surfaced
     */
    @Test
    void update_restores_the_registry_content_over_a_drifted_copy(@TempDir Path project)
            throws Exception {
        new CommandLine(new AddCommand(project, CopyInFixtures.registry())).execute("button");
        Path button = project.resolve("src/main/jte/lievit/button.jte");
        Files.writeString(button, "MY LOCAL EDIT\n");

        Result r = run(new UpdateCommand(project, CopyInFixtures.registry()), "button");

        assertThat(r.exitCode()).isZero();
        assertThat(read(button)).isEqualTo(CopyInFixtures.BUTTON_CONTENT);
        assertThat(r.stdout()).contains("local edits replaced");
        assertThat(r.stdout()).contains("Run `lievit diff` before update");
    }

    /**
     * @spec.given an up-to-date local copy
     * @spec.when `lievit update button` runs
     * @spec.then nothing is rewritten and the file is reported as already the same
     */
    @Test
    void update_on_a_clean_copy_changes_nothing(@TempDir Path project) {
        new CommandLine(new AddCommand(project, CopyInFixtures.registry())).execute("button");

        Result r = run(new UpdateCommand(project, CopyInFixtures.registry()), "button");

        assertThat(r.exitCode()).isZero();
        assertThat(r.stdout()).contains("same").contains("button.jte");
    }

    /**
     * @spec.given a drifted local copy and --dry-run
     * @spec.when `lievit update button --dry-run` runs
     * @spec.then it previews the replacement without writing the file
     */
    @Test
    void update_dry_run_writes_nothing(@TempDir Path project) throws Exception {
        new CommandLine(new AddCommand(project, CopyInFixtures.registry())).execute("button");
        Path button = project.resolve("src/main/jte/lievit/button.jte");
        Files.writeString(button, "MY LOCAL EDIT\n");

        Result r = run(new UpdateCommand(project, CopyInFixtures.registry()), "button", "--dry-run");

        assertThat(r.exitCode()).isZero();
        assertThat(r.stdout()).contains("Dry run").contains("local edits would be lost");
        assertThat(read(button)).isEqualTo("MY LOCAL EDIT\n");
    }
}

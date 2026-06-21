package io.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import io.lievit.cli.command.AddCommand;
import picocli.CommandLine;

/**
 * CLI tests for {@code lievit add}: the shadcn-style copy-in. Each test runs the real command
 * against a {@link TempDir} adopter project and the {@link CopyInFixtures} registry (via the
 * {@code (projectDir, registry)} seam), then asserts the files that landed on disk — the same
 * fixture-on-disk pattern as {@code CheckDirectivesCommandTest}.
 */
class AddCommandTest {

    private static Result run(Path projectDir, String... args) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        PrintStream savedOut = System.out;
        PrintStream savedErr = System.err;
        System.setOut(new PrintStream(out, true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(err, true, StandardCharsets.UTF_8));
        try {
            int code =
                    new CommandLine(new AddCommand(projectDir, CopyInFixtures.registry())).execute(args);
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
     * @spec.given an empty adopter project and the lievit-ui registry
     * @spec.when `lievit add button` runs
     * @spec.then button.jte lands under src/main/jte and its tokens dependency under the alias root
     */
    @Test
    void add_button_writes_the_component_and_its_token_dependency(@TempDir Path project)
            throws Exception {
        Result r = run(project, "button");

        assertThat(r.exitCode()).isZero();
        Path button = project.resolve("src/main/jte/lievit/button.jte");
        Path tokens = project.resolve("src/styles/lievit-tokens.css");
        assertThat(button).exists();
        assertThat(tokens).exists();
        assertThat(read(button)).isEqualTo(CopyInFixtures.BUTTON_CONTENT);
        assertThat(read(tokens)).isEqualTo(CopyInFixtures.TOKENS_CONTENT);
        assertThat(r.stdout()).contains("src/main/jte/lievit/button.jte");
    }

    /**
     * @spec.given a project where button.jte was already copied and locally edited
     * @spec.when `lievit add button` runs again without --overwrite
     * @spec.then the existing file is skipped (the adopter's edits are preserved)
     */
    @Test
    void add_is_idempotent_and_refuses_to_clobber_without_overwrite(@TempDir Path project)
            throws Exception {
        Path button = project.resolve("src/main/jte/lievit/button.jte");
        Files.createDirectories(button.getParent());
        Files.writeString(button, "MY LOCAL EDIT\n");

        Result r = run(project, "button");

        assertThat(r.exitCode()).isZero();
        assertThat(r.stdout()).contains("skip").contains("button.jte");
        assertThat(read(button)).isEqualTo("MY LOCAL EDIT\n");
    }

    /**
     * @spec.given an existing local button.jte and the --overwrite flag
     * @spec.when `lievit add button --overwrite` runs
     * @spec.then the registry content replaces the local copy
     */
    @Test
    void add_overwrite_replaces_an_existing_file(@TempDir Path project) throws Exception {
        Path button = project.resolve("src/main/jte/lievit/button.jte");
        Files.createDirectories(button.getParent());
        Files.writeString(button, "MY LOCAL EDIT\n");

        Result r = run(project, "button", "--overwrite");

        assertThat(r.exitCode()).isZero();
        assertThat(read(button)).isEqualTo(CopyInFixtures.BUTTON_CONTENT);
    }

    /**
     * @spec.given a component name not in the registry
     * @spec.when `lievit add` is asked for it
     * @spec.then it exits 1 with an unknown-item message and writes nothing
     */
    @Test
    void add_unknown_component_exits_one(@TempDir Path project) {
        Result r = run(project, "does-not-exist");

        assertThat(r.exitCode()).isEqualTo(1);
        assertThat(r.stderr()).contains("unknown registry item: does-not-exist");
    }

    /**
     * @spec.given the --dry-run flag
     * @spec.when `lievit add button --dry-run` runs
     * @spec.then it prints the plan and writes no file
     */
    @Test
    void add_dry_run_writes_nothing(@TempDir Path project) {
        Result r = run(project, "button", "--dry-run");

        assertThat(r.exitCode()).isZero();
        assertThat(r.stdout()).contains("Dry run");
        assertThat(project.resolve("src/main/jte/lievit/button.jte")).doesNotExist();
    }
}

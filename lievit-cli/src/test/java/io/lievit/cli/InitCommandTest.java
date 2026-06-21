package io.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import io.lievit.cli.command.InitCommand;
import picocli.CommandLine;

/**
 * CLI tests for {@code lievit init}: scaffolding an adopter for the copy-in flow.
 */
class InitCommandTest {

    private static Result run(Path project, String... args) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        PrintStream savedOut = System.out;
        PrintStream savedErr = System.err;
        System.setOut(new PrintStream(out, true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(err, true, StandardCharsets.UTF_8));
        try {
            int code =
                    new CommandLine(new InitCommand(project, CopyInFixtures.registry())).execute(args);
            return new Result(
                    code, out.toString(StandardCharsets.UTF_8), err.toString(StandardCharsets.UTF_8));
        } finally {
            System.setOut(savedOut);
            System.setErr(savedErr);
        }
    }

    private record Result(int exitCode, String stdout, String stderr) {}

    /**
     * @spec.given an empty project
     * @spec.when `lievit init` runs
     * @spec.then it creates the JTE root, drops the tokens, and prints the next steps
     */
    @Test
    void init_scaffolds_jte_root_and_tokens(@TempDir Path project) {
        Result r = run(project);

        assertThat(r.exitCode()).isZero();
        assertThat(project.resolve("src/main/jte")).isDirectory();
        assertThat(project.resolve("src/styles/lievit-tokens.css")).exists();
        assertThat(r.stdout()).contains("Next steps").contains("lievit add button");
    }

    /**
     * @spec.given a project already initialized (tokens present)
     * @spec.when `lievit init` runs again
     * @spec.then it is a no-op that keeps the existing tokens untouched
     */
    @Test
    void init_is_idempotent(@TempDir Path project) throws Exception {
        run(project);
        Path tokens = project.resolve("src/styles/lievit-tokens.css");
        Files.writeString(tokens, "/* my themed tokens */\n");

        Result r = run(project);

        assertThat(r.exitCode()).isZero();
        assertThat(r.stdout()).contains("keep").contains("already present");
        assertThat(Files.readString(tokens, StandardCharsets.UTF_8))
                .isEqualTo("/* my themed tokens */\n");
    }
}

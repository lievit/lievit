package dev.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import dev.lievit.cli.command.CheckDirectivesCommand;
import picocli.CommandLine;

/**
 * Unit tests for {@code lievit check-directives}: the compile-time half of the unknown-{@code l:}
 * directive poka-yoke (ADR-0082). Fixtures are written to a {@link TempDir} as real source
 * {@code .jte} files (the same pattern the convert command tests use), so the test exercises the
 * actual directory walk + {@code DirectiveValidator}, not a stub.
 */
class CheckDirectivesCommandTest {

    /** Runs the command over {@code dir}, capturing stderr so the failure message can be asserted. */
    private static Result run(Path dir, String... extraArgs) {
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream savedErr = System.err;
        PrintStream savedOut = System.out;
        System.setErr(new PrintStream(err, true, StandardCharsets.UTF_8));
        System.setOut(new PrintStream(out, true, StandardCharsets.UTF_8));
        try {
            String[] args = new String[extraArgs.length + 1];
            args[0] = dir.toString();
            System.arraycopy(extraArgs, 0, args, 1, extraArgs.length);
            int code = new CommandLine(new CheckDirectivesCommand()).execute(args);
            return new Result(code, out.toString(StandardCharsets.UTF_8), err.toString(StandardCharsets.UTF_8));
        } finally {
            System.setErr(savedErr);
            System.setOut(savedOut);
        }
    }

    private static void write(Path dir, String rel, String body) throws Exception {
        Path file = dir.resolve(rel);
        Files.createDirectories(file.getParent());
        Files.writeString(file, body);
    }

    private record Result(int exitCode, String stdout, String stderr) {}

    /**
     * @spec.given a source template tree whose .jte use only known l: directives
     * @spec.when check-directives scans it
     * @spec.then it exits 0 and reports the scanned template count
     */
    @Test
    void clean_tree_exits_zero(@TempDir Path dir) throws Exception {
        write(dir, "jte/list.jte", "<button l:click=\"$set('armed', id)\">arm</button>\n");
        write(dir, "jte/form/edit.jte", "<input l:model.live=\"name\"><span l:text=\"name\"></span>\n");

        Result r = run(dir);

        assertThat(r.exitCode()).isZero();
        assertThat(r.stdout()).contains("2 template(s) scanned").contains("no unknown l: directives");
    }

    /**
     * @spec.given a source template carrying the l:value bug from the ADR (l:value is not a directive)
     * @spec.when check-directives scans it
     * @spec.then it exits 1 with a file:line message and the canonical $set hint
     */
    @Test
    void unknown_directive_exits_one_with_helpful_message(@TempDir Path dir) throws Exception {
        write(
                dir,
                "jte/listing-list.jte",
                "<div>\n  <button l:model=\"x\" l:value=\"${id}\" l:click=\"arm\">go</button>\n</div>\n");

        Result r = run(dir);

        assertThat(r.exitCode()).isEqualTo(1);
        assertThat(r.stderr())
                .contains("listing-list.jte:2")
                .contains("unknown lievit directive 'l:value'")
                .contains("$set('field', value)");
    }

    /**
     * @spec.given a template using a custom directive name allowlisted via --extra
     * @spec.when check-directives scans it with that allowlist
     * @spec.then the custom directive is accepted and it exits 0
     */
    @Test
    void extra_allowlist_accepts_custom_directive(@TempDir Path dir) throws Exception {
        write(dir, "jte/widget.jte", "<div l:tooltip=\"hello\">hi</div>\n");

        assertThat(run(dir).exitCode())
                .as("without --extra the custom directive is unknown")
                .isEqualTo(1);

        Result r = run(dir, "--extra", "tooltip");

        assertThat(r.exitCode()).isZero();
        assertThat(r.stdout()).contains("no unknown l: directives");
    }

    /**
     * @spec.given multiple comma-separated names passed to --extra
     * @spec.when check-directives scans a tree using all of them
     * @spec.then every allowlisted name is accepted and it exits 0
     */
    @Test
    void extra_allowlist_is_comma_separated(@TempDir Path dir) throws Exception {
        write(dir, "jte/a.jte", "<div l:tooltip=\"a\" l:popover=\"b\"></div>\n");

        Result r = run(dir, "--extra", "tooltip,popover");

        assertThat(r.exitCode()).isZero();
    }

    /**
     * @spec.given a path that is not a directory
     * @spec.when check-directives is pointed at it
     * @spec.then it exits 2 (usage error) without scanning
     */
    @Test
    void missing_directory_exits_two(@TempDir Path dir) {
        Result r = run(dir.resolve("does-not-exist"));

        assertThat(r.exitCode()).isEqualTo(2);
        assertThat(r.stderr()).contains("not a directory");
    }

    /**
     * @spec.given an empty directory with no .jte source files
     * @spec.when check-directives scans it
     * @spec.then it exits 0 (nothing to validate is not a failure)
     */
    @Test
    void empty_tree_exits_zero(@TempDir Path dir) {
        Result r = run(dir);

        assertThat(r.exitCode()).isZero();
        assertThat(r.stdout()).contains("0 template(s) scanned");
    }
}

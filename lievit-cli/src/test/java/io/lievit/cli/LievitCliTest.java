package io.lievit.cli;

import org.junit.jupiter.api.Test;
import picocli.CommandLine;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @spec.given the lievit CLI entry point
 * @spec.when invoked with --help or an unknown command
 * @spec.then exits with the expected code
 */
class LievitCliTest {

    private CommandLine commandLine() {
        return new CommandLine(new LievitCli());
    }

    /**
     * @spec.given the lievit CLI
     * @spec.when invoked with --help
     * @spec.then exits with code 0
     */
    @Test
    void help_flag_exits_zero() {
        int exitCode = commandLine().execute("--help");
        assertThat(exitCode).isZero();
    }

    /**
     * @spec.given the lievit CLI
     * @spec.when invoked with --version
     * @spec.then exits with code 0
     */
    @Test
    void version_flag_exits_zero() {
        int exitCode = commandLine().execute("--version");
        assertThat(exitCode).isZero();
    }

    /**
     * @spec.given the lievit CLI
     * @spec.when invoked with an unknown subcommand
     * @spec.then exits with a non-zero code (picocli usage error = 2)
     */
    @Test
    void unknown_subcommand_exits_nonzero() {
        int exitCode = commandLine().execute("nonexistent-command");
        assertThat(exitCode).isNotZero();
    }

    /**
     * @spec.given the lievit CLI
     * @spec.when invoked with no arguments
     * @spec.then exits with code 2 (picocli usage error: subcommand required)
     */
    @Test
    void no_args_exits_usage_error() {
        int exitCode = commandLine().execute();
        // picocli returns 2 (ExitCode.USAGE) when a required subcommand is missing.
        assertThat(exitCode).isEqualTo(2);
    }
}

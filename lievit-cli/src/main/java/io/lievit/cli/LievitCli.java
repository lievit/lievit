package io.lievit.cli;

import io.lievit.cli.command.DevCommand;
import io.lievit.cli.command.DoctorCommand;
import io.lievit.cli.command.NewCommand;
import picocli.CommandLine;
import picocli.CommandLine.Command;

/**
 * Main entry point for the {@code lievit} CLI.
 *
 * <p>The CLI is a thin developer tool — not a Spring Boot app. It delegates
 * to three subcommands:
 * <ul>
 *   <li>{@code lievit new <name>} — scaffold a new lievit project</li>
 *   <li>{@code lievit dev} — run the project with live-reload</li>
 *   <li>{@code lievit doctor} — check Java/Maven/project prerequisites</li>
 * </ul>
 *
 * <p>Exit codes: 0 = success, 1 = user error or precondition failure,
 * 2 = usage error (picocli default for bad args).
 */
@Command(
    name = "lievit",
    mixinStandardHelpOptions = true,
    version = "lievit 0.1.0-SNAPSHOT",
    description = {
        "HTML over the wire for Spring. Type-safe. Native. EU-grade.",
        "",
        "Run @|bold lievit <subcommand> --help|@ for subcommand usage."
    },
    subcommands = {
        NewCommand.class,
        DevCommand.class,
        DoctorCommand.class,
        CommandLine.HelpCommand.class
    }
)
public class LievitCli {

    /**
     * Entry point. Delegates all execution to picocli, which dispatches to
     * the matched subcommand and returns the exit code.
     */
    public static void main(String[] args) {
        int exitCode = new CommandLine(new LievitCli()).execute(args);
        System.exit(exitCode);
    }
}

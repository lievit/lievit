package dev.lievit.cli;

import dev.lievit.cli.command.AddCommand;
import dev.lievit.cli.command.CheckDirectivesCommand;
import dev.lievit.cli.command.ConvertCommand;
import dev.lievit.cli.command.DevCommand;
import dev.lievit.cli.command.DiffCommand;
import dev.lievit.cli.command.DoctorCommand;
import dev.lievit.cli.command.InitCommand;
import dev.lievit.cli.command.MakeComponentCommand;
import dev.lievit.cli.command.MakeFormCommand;
import dev.lievit.cli.command.MakeLayoutCommand;
import dev.lievit.cli.command.NewCommand;
import dev.lievit.cli.command.UpdateCommand;
import picocli.CommandLine;
import picocli.CommandLine.Command;

/**
 * Main entry point for the {@code lievit} CLI.
 *
 * <p>The CLI is a thin developer tool, not a Spring Boot app. Its subcommands include:
 * <ul>
 *   <li>{@code lievit new <name>} scaffold a new lievit project</li>
 *   <li>{@code lievit init} scaffold the project for the copy-in flow (jte root + tokens)</li>
 *   <li>{@code lievit add <component>} copy a lievit-ui component (+ deps) into the project</li>
 *   <li>{@code lievit diff <component>} show drift between the local copy and the registry</li>
 *   <li>{@code lievit update <component>} re-copy the registry source over the local copy</li>
 *   <li>{@code lievit dev} run the project with live-reload</li>
 *   <li>{@code lievit doctor} check Java/Maven/project prerequisites</li>
 *   <li>{@code lievit check-directives <dir>} build-time poka-yoke over source .jte templates</li>
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
        InitCommand.class,
        AddCommand.class,
        DiffCommand.class,
        UpdateCommand.class,
        MakeComponentCommand.class,
        MakeFormCommand.class,
        MakeLayoutCommand.class,
        ConvertCommand.class,
        DevCommand.class,
        DoctorCommand.class,
        CheckDirectivesCommand.class,
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

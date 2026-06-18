package io.lievit.cli.command;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Callable;

import picocli.CommandLine.Command;

/**
 * {@code lievit dev}
 *
 * <p>Starts the Spring Boot application in the current directory with live-reload
 * enabled via Spring DevTools.
 *
 * <p>Contract (invariants, do not change without an ADR):
 * <ul>
 *   <li>Requires a {@code pom.xml} in the current working directory.</li>
 *   <li>Requires {@code spring-boot-devtools} on the classpath of the target project.</li>
 *   <li>Delegates to: {@code mvn spring-boot:run
 *       -Dspring-boot.run.jvmArguments="-Dspring.devtools.restart.enabled=true"}</li>
 *   <li>Streams stdout/stderr of the subprocess to this process's own streams.</li>
 *   <li>Exit code mirrors the Maven subprocess exit code.</li>
 * </ul>
 */
@Command(
    name = "dev",
    mixinStandardHelpOptions = true,
    description = {
        "Start the lievit project in the current directory with live-reload.",
        "",
        "Requires: pom.xml in CWD; spring-boot-devtools on the project classpath.",
        "Delegates to: mvn spring-boot:run -Dspring-boot.run.jvmArguments=\"-Dspring.devtools.restart.enabled=true\""
    },
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Application exited cleanly.",
        " 1:No pom.xml found in current directory.",
        " N:Exit code of the Maven subprocess."
    }
)
public class DevCommand implements Callable<Integer> {

    /**
     * Visible for testing: the command list passed to ProcessBuilder.
     * Tests can inspect this without actually running Maven.
     */
    public static List<String> buildCommand() {
        return List.of(
            "mvn", "spring-boot:run",
            "-Dspring-boot.run.jvmArguments=-Dspring.devtools.restart.enabled=true"
        );
    }

    @Override
    public Integer call() {
        Path cwd = Path.of(System.getProperty("user.dir"));
        Path pomXml = cwd.resolve("pom.xml");

        if (!Files.isRegularFile(pomXml)) {
            System.err.println("Error: no pom.xml found in current directory (" + cwd + ").");
            System.err.println("Run `lievit dev` from the root of a Maven project.");
            return 1;
        }

        List<String> command = buildCommand();
        System.out.println("Starting dev server: " + String.join(" ", command));

        try {
            Process process = new ProcessBuilder(command)
                .directory(cwd.toFile())
                .inheritIO()  // stream stdin/stdout/stderr directly to our process
                .start();

            return process.waitFor();
        } catch (IOException e) {
            System.err.println("Error starting Maven: " + e.getMessage());
            System.err.println("Make sure 'mvn' is on your PATH.");
            return 1;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return 1;
        }
    }
}

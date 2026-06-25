package dev.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import dev.lievit.cli.command.DevCommand;
import picocli.CommandLine;

/**
 * Unit tests for {@code lievit dev}.
 *
 * <p>We do NOT invoke a real Maven subprocess: that belongs to an integration test.
 * These tests check the precondition guard (pom.xml missing) and the command
 * construction contract.
 */
class DevCommandTest {

    /**
     * @spec.given no pom.xml in current working directory
     * @spec.when lievit dev is invoked
     * @spec.then exits 1 without attempting to start Maven
     */
    @Test
    void missing_pom_xml_exits_one(@TempDir Path tempDir) {
        String originalUserDir = System.getProperty("user.dir");
        try {
            System.setProperty("user.dir", tempDir.toString());
            // tempDir has no pom.xml
            int exitCode = new CommandLine(new DevCommand()).execute();
            assertThat(exitCode).isEqualTo(1);
        } finally {
            System.setProperty("user.dir", originalUserDir);
        }
    }

    /**
     * @spec.given a directory with a pom.xml
     * @spec.when lievit dev is invoked (we only test command construction, not execution)
     * @spec.then the command list starts with mvn spring-boot:run and includes devtools flag
     */
    @Test
    void command_construction_is_correct() {
        List<String> command = DevCommand.buildCommand();

        assertThat(command).isNotEmpty();
        assertThat(command.get(0)).isEqualTo("mvn");
        assertThat(command).contains("spring-boot:run");
        // Devtools restart flag must be passed as a JVM argument.
        assertThat(String.join(" ", command))
            .contains("spring.devtools.restart.enabled=true");
    }

    /**
     * @spec.given the dev command contract
     * @spec.when checking the command list
     * @spec.then it does not include any interactive flags (-i, --interactive)
     *            that would block a non-TTY environment
     */
    @Test
    void command_has_no_interactive_flags() {
        List<String> command = DevCommand.buildCommand();
        assertThat(command).doesNotContain("-i", "--interactive");
    }
}

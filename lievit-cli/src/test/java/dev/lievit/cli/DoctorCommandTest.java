package dev.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import dev.lievit.cli.command.DoctorCommand;
import dev.lievit.cli.env.CliEnvironment;
import picocli.CommandLine;

/**
 * Unit tests for {@code lievit doctor}.
 *
 * <p>Uses a mocked {@link CliEnvironment} so no real Java version check,
 * Maven invocation, or filesystem access occurs.
 */
@ExtendWith(MockitoExtension.class)
class DoctorCommandTest {

    @Mock
    CliEnvironment env;

    private int runDoctor() {
        DoctorCommand cmd = new DoctorCommand(env);
        return new CommandLine(cmd).execute();
    }

    /**
     * @spec.given Java 25 and Maven available and no pom.xml in cwd
     * @spec.when doctor runs
     * @spec.then exits 0
     */
    @Test
    void all_checks_pass_exits_zero() {
        when(env.getJavaVersion()).thenReturn("25.0.1");
        when(env.isMavenAvailable()).thenReturn(true);
        when(env.hasFile("pom.xml")).thenReturn(false);

        assertThat(runDoctor()).isZero();
    }

    /**
     * @spec.given Java 17 (below minimum 25)
     * @spec.when doctor runs
     * @spec.then exits 1
     */
    @Test
    void java_too_old_exits_one() {
        when(env.getJavaVersion()).thenReturn("17.0.8");
        when(env.isMavenAvailable()).thenReturn(true);
        when(env.hasFile("pom.xml")).thenReturn(false);

        assertThat(runDoctor()).isEqualTo(1);
    }

    /**
     * @spec.given Maven not on PATH
     * @spec.when doctor runs
     * @spec.then exits 1
     */
    @Test
    void maven_missing_exits_one() {
        when(env.getJavaVersion()).thenReturn("25.0.1");
        when(env.isMavenAvailable()).thenReturn(false);
        when(env.hasFile("pom.xml")).thenReturn(false);

        assertThat(runDoctor()).isEqualTo(1);
    }

    /**
     * @spec.given all bad: Java too old AND Maven missing
     * @spec.when doctor runs
     * @spec.then exits 1
     */
    @Test
    void multiple_failures_exits_one() {
        when(env.getJavaVersion()).thenReturn("11.0.2");
        when(env.isMavenAvailable()).thenReturn(false);
        when(env.hasFile("pom.xml")).thenReturn(false);

        assertThat(runDoctor()).isEqualTo(1);
    }

    /**
     * @spec.given Java 25+, Maven available, pom.xml present, application.properties present with spring.application.name
     * @spec.when doctor runs
     * @spec.then exits 0
     */
    @Test
    void all_checks_pass_including_project_check(@org.junit.jupiter.api.io.TempDir Path tempDir) throws Exception {
        // Write a real application.properties for the project check (DoctorCommand reads it via Files.readString).
        Path propsDir = tempDir.resolve("src/main/resources");
        java.nio.file.Files.createDirectories(propsDir);
        java.nio.file.Files.writeString(propsDir.resolve("application.properties"), "spring.application.name=test\n");

        when(env.getJavaVersion()).thenReturn("25.0.1");
        when(env.isMavenAvailable()).thenReturn(true);
        when(env.hasFile("pom.xml")).thenReturn(true);
        when(env.hasFile("src/main/resources/application.properties")).thenReturn(true);
        when(env.getCwd()).thenReturn(tempDir);

        assertThat(runDoctor()).isZero();
    }

    // --- parseMajorVersion unit tests (package-private static method, tested directly) ---

    @ParameterizedTest
    @ValueSource(strings = {"25", "25.0.1", "25.0.1+8"})
    void parse_major_modern_format(String version) {
        assertThat(DoctorCommand.parseMajorVersion(version)).isEqualTo(25);
    }

    @Test
    void parse_major_legacy_format() {
        assertThat(DoctorCommand.parseMajorVersion("1.8.0_202")).isEqualTo(8);
    }

    @Test
    void parse_major_null_returns_zero() {
        assertThat(DoctorCommand.parseMajorVersion(null)).isZero();
    }

    @Test
    void parse_major_blank_returns_zero() {
        assertThat(DoctorCommand.parseMajorVersion("  ")).isZero();
    }
}

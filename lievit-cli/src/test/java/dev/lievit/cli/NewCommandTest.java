package dev.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import dev.lievit.cli.command.NewCommand;
import picocli.CommandLine;

/**
 * Unit tests for {@code lievit new <name>}.
 */
class NewCommandTest {

    /**
     * @spec.given a project name that does not yet exist on disk
     * @spec.when lievit new is invoked
     * @spec.then exits 0 and creates the expected project structure
     */
    @Test
    void happy_path_creates_project_files(@TempDir Path tempDir) throws IOException {
        String originalUserDir = System.getProperty("user.dir");
        try {
            System.setProperty("user.dir", tempDir.toString());

            int exitCode = new CommandLine(new NewCommand()).execute("myapp");

            assertThat(exitCode).isZero();

            Path projectDir = tempDir.resolve("myapp");
            assertThat(projectDir).isDirectory();
            assertThat(projectDir.resolve("pom.xml")).isRegularFile();

            Path pkgDir = projectDir.resolve("src/main/java/com/example/myapp");
            assertThat(pkgDir.resolve("Application.java")).isRegularFile();
            assertThat(pkgDir.resolve("HelloComponent.java")).isRegularFile();
            assertThat(projectDir.resolve("src/main/resources/application.properties")).isRegularFile();
        } finally {
            System.setProperty("user.dir", originalUserDir);
        }
    }

    /**
     * @spec.given a project name that already exists as a directory
     * @spec.when lievit new is invoked
     * @spec.then exits 1 without overwriting
     */
    @Test
    void existing_directory_fails_with_exit_1(@TempDir Path tempDir) throws IOException {
        String originalUserDir = System.getProperty("user.dir");
        try {
            System.setProperty("user.dir", tempDir.toString());

            // Pre-create the directory to simulate the collision.
            Files.createDirectory(tempDir.resolve("existingproject"));

            int exitCode = new CommandLine(new NewCommand()).execute("existingproject");

            assertThat(exitCode).isEqualTo(1);
        } finally {
            System.setProperty("user.dir", originalUserDir);
        }
    }

    /**
     * @spec.given a project name with hyphens and digits
     * @spec.when sanitizePackageName is called
     * @spec.then returns a lowercase alphanumeric-only string valid for a Java package segment
     */
    @Test
    void sanitize_package_name_strips_hyphens_and_uppercases() {
        NewCommand cmd = new NewCommand();
        assertThat(cmd.sanitizePackageName("my-project-2")).isEqualTo("myproject2");
        assertThat(cmd.sanitizePackageName("HelloWorld")).isEqualTo("helloworld");
        assertThat(cmd.sanitizePackageName("simple")).isEqualTo("simple");
    }

    /**
     * @spec.given a scaffolded pom.xml
     * @spec.when lievit new creates a project
     * @spec.then pom.xml contains the lievit-spring-boot-starter dependency
     */
    @Test
    void scaffolded_pom_references_lievit_starter(@TempDir Path tempDir) throws IOException {
        String originalUserDir = System.getProperty("user.dir");
        try {
            System.setProperty("user.dir", tempDir.toString());
            new CommandLine(new NewCommand()).execute("checkpom");

            String pomContent = Files.readString(tempDir.resolve("checkpom/pom.xml"));
            assertThat(pomContent).contains("lievit-spring-boot-starter");
            assertThat(pomContent).contains("spring-boot-devtools");
        } finally {
            System.setProperty("user.dir", originalUserDir);
        }
    }

    /**
     * @spec.given a scaffolded Application.java
     * @spec.when lievit new creates a project
     * @spec.then Application.java contains @EnableLievit and @SpringBootApplication
     */
    @Test
    void scaffolded_application_has_enable_lievit(@TempDir Path tempDir) throws IOException {
        String originalUserDir = System.getProperty("user.dir");
        try {
            System.setProperty("user.dir", tempDir.toString());
            new CommandLine(new NewCommand()).execute("checkapp");

            Path appJava = tempDir.resolve("checkapp/src/main/java/com/example/checkapp/Application.java");
            String content = Files.readString(appJava);
            assertThat(content).contains("@EnableLievit");
            assertThat(content).contains("@SpringBootApplication");
        } finally {
            System.setProperty("user.dir", originalUserDir);
        }
    }
}

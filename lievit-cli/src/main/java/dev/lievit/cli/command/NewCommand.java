package dev.lievit.cli.command;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;

import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

/**
 * {@code lievit new <name>}
 *
 * <p>Scaffolds a new lievit project in a directory named {@code <name>} under the
 * current working directory. The scaffold is a minimal but runnable Spring Boot 4 +
 * lievit project:
 * <ul>
 *   <li>{@code pom.xml} — Spring Boot parent + lievit-spring-boot-starter</li>
 *   <li>{@code Application.java} — {@code @SpringBootApplication @EnableLievit} main class</li>
 *   <li>{@code HelloComponent.java} — sample {@code @LievitComponent} with a {@code @LievitAction}</li>
 *   <li>{@code application.properties} — minimal config</li>
 * </ul>
 *
 * <p>Exit codes: 0 = project created, 1 = target directory already exists.
 *
 * <p>// TODO: source scaffold from examples/golden-path-starter once available.
 * For now the scaffold is inlined here. When the golden-path-starter module ships,
 * replace the inline strings with a resource-copy from the starter zip/archive.
 */
@Command(
    name = "new",
    mixinStandardHelpOptions = true,
    description = "Scaffold a new lievit project.",
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:Project created successfully.",
        " 1:Target directory already exists."
    }
)
public class NewCommand implements Callable<Integer> {

    @Parameters(index = "0", paramLabel = "<name>", description = "Project name (used as directory name and artifact ID).")
    String name;

    @Override
    public Integer call() {
        Path projectDir = Path.of(System.getProperty("user.dir")).resolve(name);

        if (Files.exists(projectDir)) {
            System.err.println("Error: directory '" + name + "' already exists.");
            return 1;
        }

        try {
            createProject(projectDir);
        } catch (IOException e) {
            System.err.println("Error creating project: " + e.getMessage());
            return 1;
        }

        System.out.println("Created project '" + name + "'. Run: cd " + name + " && mvn spring-boot:run");
        return 0;
    }

    private void createProject(Path projectDir) throws IOException {
        String pkg = "com.example." + sanitizePackageName(name);
        String pkgPath = pkg.replace('.', '/');

        Path mainJava = projectDir.resolve("src/main/java/" + pkgPath);
        Path mainResources = projectDir.resolve("src/main/resources");

        Files.createDirectories(mainJava);
        Files.createDirectories(mainResources);

        writeFile(projectDir.resolve("pom.xml"), pomXml(name));
        writeFile(mainJava.resolve("Application.java"), applicationJava(pkg));
        writeFile(mainJava.resolve("HelloComponent.java"), helloComponentJava(pkg));
        writeFile(mainResources.resolve("application.properties"), applicationProperties(name));
    }

    private void writeFile(Path path, String content) throws IOException {
        Files.writeString(path, content);
    }

    // Strips non-alphanumeric chars and lowercases; safe for a Java package segment.
    public String sanitizePackageName(String input) {
        return input.replaceAll("[^A-Za-z0-9]", "").toLowerCase();
    }

    // --- Scaffold templates ---

    private String pomXml(String artifactId) {
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <project xmlns="http://maven.apache.org/POM/4.0.0"
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                     xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
                <modelVersion>4.0.0</modelVersion>

                <parent>
                    <groupId>org.springframework.boot</groupId>
                    <artifactId>spring-boot-starter-parent</artifactId>
                    <version>4.0.6</version>
                    <relativePath/>
                </parent>

                <groupId>com.example</groupId>
                <artifactId>%s</artifactId>
                <version>0.0.1-SNAPSHOT</version>
                <name>%s</name>
                <description>lievit project scaffolded by `lievit new`</description>

                <properties>
                    <java.version>25</java.version>
                </properties>

                <dependencies>
                    <dependency>
                        <groupId>dev.lievit</groupId>
                        <artifactId>lievit-spring-boot-starter</artifactId>
                        <version>0.1.0-SNAPSHOT</version>
                    </dependency>
                    <dependency>
                        <groupId>org.springframework.boot</groupId>
                        <artifactId>spring-boot-devtools</artifactId>
                        <scope>runtime</scope>
                        <optional>true</optional>
                    </dependency>
                    <dependency>
                        <groupId>org.springframework.boot</groupId>
                        <artifactId>spring-boot-starter-test</artifactId>
                        <scope>test</scope>
                    </dependency>
                </dependencies>

                <build>
                    <plugins>
                        <plugin>
                            <groupId>org.springframework.boot</groupId>
                            <artifactId>spring-boot-maven-plugin</artifactId>
                        </plugin>
                    </plugins>
                </build>
            </project>
            """.formatted(artifactId, artifactId);
    }

    private String applicationJava(String pkg) {
        return """
            package %s;

            import dev.lievit.EnableLievit;
            import org.springframework.boot.SpringApplication;
            import org.springframework.boot.autoconfigure.SpringBootApplication;

            @SpringBootApplication
            @EnableLievit
            public class Application {

                public static void main(String[] args) {
                    SpringApplication.run(Application.class, args);
                }
            }
            """.formatted(pkg);
    }

    private String helloComponentJava(String pkg) {
        return """
            package %s;

            import dev.lievit.LievitAction;
            import dev.lievit.LievitComponent;
            import dev.lievit.Wire;

            /**
             * Sample lievit component.
             *
             * <p>Demonstrates: a @Wire field kept in sync between server and browser,
             * and a @LievitAction callable from the template.
             *
             * <p>Delete or replace this class once you have your own components.
             */
            @LievitComponent
            public class HelloComponent {

                @Wire
                String message = "Hello from lievit!";

                @LievitAction
                public void greet() {
                    message = "You clicked the button! lievit is working.";
                }
            }
            """.formatted(pkg);
    }

    private String applicationProperties(String appName) {
        return """
            spring.application.name=%s
            """.formatted(appName);
    }
}

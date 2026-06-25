package dev.lievit.cli.env;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Production implementation of {@link CliEnvironment}.
 *
 * <p>Reads from the real JVM system properties, PATH, and filesystem.
 * Stateless and safe to share across subcommand instances.
 */
public class DefaultCliEnvironment implements CliEnvironment {

    @Override
    public String getJavaVersion() {
        return System.getProperty("java.version");
    }

    @Override
    public boolean isMavenAvailable() {
        try {
            Process process = new ProcessBuilder("mvn", "-version")
                .redirectErrorStream(true)
                .start();
            int exitCode = process.waitFor();
            return exitCode == 0;
        } catch (IOException | InterruptedException e) {
            // mvn not found on PATH or process interrupted: treat as unavailable.
            Thread.currentThread().interrupt();
            return false;
        }
    }

    @Override
    public Path getCwd() {
        return Path.of(System.getProperty("user.dir"));
    }

    @Override
    public boolean hasFile(String relativePath) {
        Path target = getCwd().resolve(relativePath);
        return Files.isRegularFile(target);
    }
}

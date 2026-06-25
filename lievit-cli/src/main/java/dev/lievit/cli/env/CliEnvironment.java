package dev.lievit.cli.env;

import java.nio.file.Path;

/**
 * Abstraction over the OS/JVM environment used by CLI subcommands.
 *
 * <p>Injected into subcommands that need it so unit tests can mock out
 * process-level side effects (Java version, Maven availability, filesystem).
 * The production implementation is {@link DefaultCliEnvironment}.
 */
public interface CliEnvironment {

    /**
     * Returns the running JVM's version string, e.g. {@code "25.0.1"}.
     * Reads {@code System.getProperty("java.version")}.
     */
    String getJavaVersion();

    /**
     * Returns {@code true} if {@code mvn} is executable on the current PATH.
     * Determined by running {@code mvn -version} and checking the exit code.
     */
    boolean isMavenAvailable();

    /**
     * Returns the current working directory as a {@link Path}.
     */
    Path getCwd();

    /**
     * Returns {@code true} if the file at {@code relativePath} (relative to
     * the current working directory) exists and is a regular file.
     */
    boolean hasFile(String relativePath);
}

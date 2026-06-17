package io.lievit.cli.command;

import io.lievit.cli.env.CliEnvironment;
import io.lievit.cli.env.DefaultCliEnvironment;
import picocli.CommandLine.Command;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

/**
 * {@code lievit doctor}
 *
 * <p>Runs a set of local sanity checks and prints the result of each one.
 * No network calls are made.
 *
 * <p>Checks:
 * <ol>
 *   <li>Java version is >= 25 (required by lievit and Spring Boot 4).</li>
 *   <li>Maven is available on PATH ({@code mvn -version} exits 0).</li>
 *   <li>If run inside a project: {@code application.properties} exists and contains
 *       {@code spring.application.name}.</li>
 * </ol>
 *
 * <p>Each check prints: {@code [OK] <description>} or {@code [FAIL] <description>: <action>}.
 *
 * <p>Exit codes: 0 if ALL checks pass; 1 if ANY check fails.
 */
@Command(
    name = "doctor",
    mixinStandardHelpOptions = true,
    description = {
        "Check prerequisites for lievit development.",
        "",
        "Checks: Java >= 25, Maven on PATH, project config (if inside a project).",
        "No network calls."
    },
    exitCodeListHeading = "Exit Codes:%n",
    exitCodeList = {
        " 0:All checks passed.",
        " 1:One or more checks failed."
    }
)
public class DoctorCommand implements Callable<Integer> {

    /** Minimum Java major version required by lievit + Spring Boot 4. */
    static final int MIN_JAVA_MAJOR = 25;

    // Injected for testability; defaults to the real environment.
    private final CliEnvironment env;

    /** Production constructor: uses the real environment. */
    public DoctorCommand() {
        this(new DefaultCliEnvironment());
    }

    /** Test constructor: inject a mock/stub environment. */
    public DoctorCommand(CliEnvironment env) {
        this.env = env;
    }

    @Override
    public Integer call() {
        List<CheckResult> results = new ArrayList<>();

        results.add(checkJavaVersion());
        results.add(checkMaven());

        // Project-specific checks only when a pom.xml is present in CWD.
        if (env.hasFile("pom.xml")) {
            results.add(checkApplicationProperties());
        }

        boolean allOk = true;
        for (CheckResult r : results) {
            System.out.println(r.format());
            if (!r.ok()) {
                allOk = false;
            }
        }

        return allOk ? 0 : 1;
    }

    // --- individual checks ---

    CheckResult checkJavaVersion() {
        String version = env.getJavaVersion();
        int major = parseMajorVersion(version);
        if (major >= MIN_JAVA_MAJOR) {
            return CheckResult.ok("Java " + version + " (>= " + MIN_JAVA_MAJOR + " required)");
        }
        return CheckResult.fail(
            "Java " + version,
            "Java " + MIN_JAVA_MAJOR + "+ is required. Install Temurin 25 from https://adoptium.net/"
        );
    }

    CheckResult checkMaven() {
        if (env.isMavenAvailable()) {
            return CheckResult.ok("Maven found on PATH");
        }
        return CheckResult.fail(
            "Maven not found",
            "Install Maven from https://maven.apache.org/install.html or via sdk install maven"
        );
    }

    CheckResult checkApplicationProperties() {
        String propsPath = "src/main/resources/application.properties";
        if (!env.hasFile(propsPath)) {
            return CheckResult.fail(
                "application.properties",
                propsPath + " not found. Run `lievit new` to scaffold a project."
            );
        }

        Path fullPath = env.getCwd().resolve(propsPath);
        try {
            String content = Files.readString(fullPath);
            if (content.contains("spring.application.name")) {
                return CheckResult.ok("application.properties has spring.application.name");
            }
            return CheckResult.fail(
                "application.properties missing spring.application.name",
                "Add 'spring.application.name=<your-app>' to " + propsPath
            );
        } catch (IOException e) {
            return CheckResult.fail(
                "application.properties unreadable",
                "Could not read " + propsPath + ": " + e.getMessage()
            );
        }
    }

    /**
     * Parses the major version from a JVM version string.
     * Handles both legacy ({@code "1.8.0_202"}) and modern ({@code "25.0.1"}) formats.
     */
    public static int parseMajorVersion(String version) {
        if (version == null || version.isBlank()) {
            return 0;
        }
        String trimmed = version.strip();
        // Legacy format: "1.X.Y_ZZZ"
        if (trimmed.startsWith("1.")) {
            String[] parts = trimmed.split("[._]");
            if (parts.length >= 2) {
                try {
                    return Integer.parseInt(parts[1]);
                } catch (NumberFormatException ignored) {
                    // fall through
                }
            }
        }
        // Modern format: "25.0.1" — first segment is the major.
        String firstSegment = trimmed.split("[._-]")[0];
        try {
            return Integer.parseInt(firstSegment);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // --- result value type ---

    record CheckResult(boolean ok, String description, String action) {

        static CheckResult ok(String description) {
            return new CheckResult(true, description, null);
        }

        static CheckResult fail(String description, String action) {
            return new CheckResult(false, description, action);
        }

        String format() {
            if (ok) {
                return "[OK]   " + description;
            }
            return "[FAIL] " + description + ": " + action;
        }
    }
}

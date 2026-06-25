package dev.lievit.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import dev.lievit.cli.command.MakeFormCommand;
import picocli.CommandLine;

/**
 * Spec for {@code lievit make:form <Name>} (Livewire {@code make:livewire --form} family parity, issue
 * #141): scaffolds a form component (a class with {@code @Wire} fields, an {@code @LievitAction
 * save()} and the validation hook) plus a JTE template with an {@code l:submit} form, no-overwrite,
 * kebab template name.
 */
class MakeFormCommandTest {

    /**
     * @spec.given a project with a root package
     * @spec.when  make:form ContactForm is invoked
     * @spec.then  a form class (Wire fields + save action) and a JTE template with l:submit are written
     */
    @Test
    void scaffolds_a_form_class_and_template(@TempDir Path project) throws IOException {
        Files.createDirectories(project.resolve("src/main/java/com/example/app"));

        int exit = new CommandLine(new MakeFormCommand(project)).execute("ContactForm");

        assertThat(exit).isZero();
        String src =
                Files.readString(project.resolve("src/main/java/com/example/app/ContactForm.java"));
        assertThat(src).contains("@LievitComponent(template = \"contact-form\")");
        assertThat(src).contains("@LievitAction");
        assertThat(src).contains("void save()");
        assertThat(src).contains("@Wire");
        Path template = project.resolve("src/main/jte/contact-form.jte");
        assertThat(template).isRegularFile();
        assertThat(Files.readString(template)).contains("l:submit=\"save\"");
    }

    /**
     * @spec.given an existing form class
     * @spec.when  make:form is invoked with the same name
     * @spec.then  exits 1 without overwriting
     */
    @Test
    void existing_form_fails_with_exit_1(@TempDir Path project) throws IOException {
        Path pkg = project.resolve("src/main/java/com/example/app");
        Files.createDirectories(pkg);
        Files.writeString(pkg.resolve("ContactForm.java"), "// existing");

        int exit = new CommandLine(new MakeFormCommand(project)).execute("ContactForm");

        assertThat(exit).isEqualTo(1);
        assertThat(Files.readString(pkg.resolve("ContactForm.java"))).isEqualTo("// existing");
    }
}

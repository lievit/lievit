package dev.lievit.cli.registry;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Unit spec for the minimal unified diff that {@code lievit diff} renders.
 */
class UnifiedDiffTest {

    /**
     * @spec.given two identical contents
     * @spec.when a diff is requested
     * @spec.then the diff is empty and differ() is false
     */
    @Test
    void identical_content_has_no_diff() {
        String text = "a\nb\nc\n";

        assertThat(UnifiedDiff.differ(text, text)).isFalse();
        assertThat(UnifiedDiff.diff("x.jte", text, text)).isEmpty();
    }

    /**
     * @spec.given a local copy with a changed line versus the upstream
     * @spec.when a unified diff is rendered
     * @spec.then it carries the a/ + b/ headers and the -/+ change lines
     */
    @Test
    void changed_line_is_shown_as_removal_and_addition() {
        String local = "@param String label\nlocal edit\n";
        String upstream = "@param String label\nupstream line\n";

        String diff = UnifiedDiff.diff("lievit/button.jte", local, upstream);

        assertThat(diff)
                .contains("--- a/lievit/button.jte")
                .contains("+++ b/lievit/button.jte")
                .contains(" @param String label")
                .contains("-local edit")
                .contains("+upstream line");
    }
}

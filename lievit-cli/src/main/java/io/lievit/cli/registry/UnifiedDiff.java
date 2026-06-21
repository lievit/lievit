package io.lievit.cli.registry;

import java.util.ArrayList;
import java.util.List;

/**
 * A minimal line-level unified diff, so {@code lievit diff} can show an adopter how their local copy
 * of a copied-in component has drifted from the registry's current {@code content} without pulling a
 * diff library onto the thin CLI.
 *
 * <p>It computes a longest-common-subsequence over the two line lists and renders a single
 * {@code git}-style hunk-free unified body: context lines prefixed with a space, removals with
 * {@code -}, additions with {@code +}, under {@code --- a/<label>} / {@code +++ b/<label>} headers.
 * It is deliberately not minimal-hunked: for a single small component file the whole-file body is
 * the clearest signal of upstream drift.
 */
public final class UnifiedDiff {

    private UnifiedDiff() {}

    /**
     * Renders a unified diff from {@code local} (the {@code a} side) to {@code upstream} (the
     * {@code b} side). Returns an empty string when the two are byte-identical.
     *
     * @param label    the file label shown in the {@code a/} and {@code b/} headers
     * @param local    the adopter's current file content
     * @param upstream the registry's current content
     * @return the unified diff text, or {@code ""} when there is no difference
     */
    public static String diff(String label, String local, String upstream) {
        if (local.equals(upstream)) {
            return "";
        }
        List<String> a = splitLines(local);
        List<String> b = splitLines(upstream);
        StringBuilder out = new StringBuilder();
        out.append("--- a/").append(label).append('\n');
        out.append("+++ b/").append(label).append('\n');
        out.append(body(a, b));
        return out.toString();
    }

    /** True when the two contents differ. */
    public static boolean differ(String local, String upstream) {
        return !local.equals(upstream);
    }

    private static String body(List<String> a, List<String> b) {
        int n = a.size();
        int m = b.size();
        int[][] lcs = new int[n + 1][m + 1];
        for (int i = n - 1; i >= 0; i--) {
            for (int j = m - 1; j >= 0; j--) {
                lcs[i][j] =
                        a.get(i).equals(b.get(j))
                                ? lcs[i + 1][j + 1] + 1
                                : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }
        StringBuilder sb = new StringBuilder();
        int i = 0;
        int j = 0;
        while (i < n && j < m) {
            if (a.get(i).equals(b.get(j))) {
                sb.append(' ').append(a.get(i)).append('\n');
                i++;
                j++;
            } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
                sb.append('-').append(a.get(i)).append('\n');
                i++;
            } else {
                sb.append('+').append(b.get(j)).append('\n');
                j++;
            }
        }
        while (i < n) {
            sb.append('-').append(a.get(i++)).append('\n');
        }
        while (j < m) {
            sb.append('+').append(b.get(j++)).append('\n');
        }
        return sb.toString();
    }

    /** Splits into lines, keeping a trailing empty line distinction out of scope (line-level diff). */
    private static List<String> splitLines(String text) {
        List<String> lines = new ArrayList<>();
        if (text.isEmpty()) {
            return lines;
        }
        int start = 0;
        for (int i = 0; i < text.length(); i++) {
            if (text.charAt(i) == '\n') {
                lines.add(text.substring(start, i));
                start = i + 1;
            }
        }
        if (start < text.length()) {
            lines.add(text.substring(start));
        }
        return lines;
    }
}

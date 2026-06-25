/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.OptionalDouble;
import java.util.stream.Collectors;

import org.jspecify.annotations.Nullable;

/**
 * A per-column footer/group aggregate (the Filament {@code Columns/Summarizers/*} family +
 * {@code CanBeSummarized}): a pure reduction over the cell values of the rows currently in scope,
 * carrying a human {@link #label() label} and producing a rendered string.
 *
 * <p>A summarizer never touches the repository: it folds the values the kit already extracted for
 * the in-scope rows (the active page or, when "all" scope is requested, all matching rows). The kit
 * keeps the reduction here so the same summarizer composes with filters, search and grouping
 * unchanged: the page hands it whichever row set is in scope and reads back a label + value.
 *
 * <p>Build one with the static factories ({@link #sum}, {@link #average}, {@link #count},
 * {@link #range}, {@link #values}) and attach it to a column with
 * {@link Column#summarize(Summarizer)}. A column may carry several summarizers (a Sum and a Count
 * under the same total row).
 */
public abstract class Summarizer {

    private final String defaultLabel;
    private @Nullable String label;

    /**
     * @param defaultLabel the label shown when the adopter does not override it
     */
    protected Summarizer(String defaultLabel) {
        this.defaultLabel = Objects.requireNonNull(defaultLabel, "defaultLabel");
    }

    /**
     * Overrides the label rendered next to this summary.
     *
     * @param text the label
     * @return this summarizer
     */
    public Summarizer label(String text) {
        this.label = Objects.requireNonNull(text, "text");
        return this;
    }

    /** @return the label (the override if set, else the summarizer's default) */
    public String label() {
        return label != null ? label : defaultLabel;
    }

    /**
     * Folds the in-scope cell values into the rendered summary string.
     *
     * @param values the raw cell values of the in-scope rows (may contain nulls, skipped by the
     *     numeric summarizers)
     * @return the rendered summary
     */
    public abstract String summarize(Collection<@Nullable Object> values);

    /**
     * @return a summarizer that adds the numeric cell values (labelled {@code "Sum"})
     */
    public static Summarizer sum() {
        return new Numeric("Sum") {
            @Override
            double reduce(double[] xs) {
                double total = 0;
                for (double x : xs) {
                    total += x;
                }
                return total;
            }
        };
    }

    /**
     * @return a summarizer that averages the numeric cell values (labelled {@code "Average"}); an
     *     empty set summarizes to {@code "0"}
     */
    public static Summarizer average() {
        return new Numeric("Average") {
            @Override
            double reduce(double[] xs) {
                OptionalDouble avg = java.util.Arrays.stream(xs).average();
                return avg.orElse(0);
            }
        };
    }

    /**
     * @return a summarizer that counts the in-scope rows (labelled {@code "Count"}); counts every
     *     row including null cells
     */
    public static Summarizer count() {
        return new Summarizer("Count") {
            @Override
            public String summarize(Collection<@Nullable Object> values) {
                return Integer.toString(values.size());
            }
        };
    }

    /**
     * @return a summarizer that reports the {@code "min - max"} of the numeric cell values (labelled
     *     {@code "Range"}); an empty set summarizes to {@code "0"}
     */
    public static Summarizer range() {
        return new Summarizer("Range") {
            @Override
            public String summarize(Collection<@Nullable Object> values) {
                double[] xs = Numeric.numbers(values);
                if (xs.length == 0) {
                    return "0";
                }
                double min = xs[0];
                double max = xs[0];
                for (double x : xs) {
                    min = Math.min(min, x);
                    max = Math.max(max, x);
                }
                return Numeric.render(min) + " - " + Numeric.render(max);
            }
        };
    }

    /**
     * @return a summarizer that lists the distinct non-null cell values, comma-joined in encounter
     *     order (labelled {@code "Values"})
     */
    public static Summarizer values() {
        return new Summarizer("Values") {
            @Override
            public String summarize(Collection<@Nullable Object> values) {
                List<String> distinct = new ArrayList<>();
                for (Object v : values) {
                    if (v == null) {
                        continue;
                    }
                    String s = String.valueOf(v);
                    if (!distinct.contains(s)) {
                        distinct.add(s);
                    }
                }
                return String.join(", ", distinct);
            }
        };
    }

    /** A summarizer over the numeric projection of the cell values (the {@link #reduce} fold). */
    abstract static class Numeric extends Summarizer {

        Numeric(String defaultLabel) {
            super(defaultLabel);
        }

        @Override
        public final String summarize(Collection<@Nullable Object> values) {
            double[] xs = numbers(values);
            if (xs.length == 0) {
                return "0";
            }
            return render(reduce(xs));
        }

        abstract double reduce(double[] xs);

        /** Projects the non-null, numerically-parseable cell values to doubles. */
        static double[] numbers(Collection<@Nullable Object> values) {
            return values.stream()
                    .map(Numeric::toNumber)
                    .filter(Objects::nonNull)
                    .mapToDouble(Number::doubleValue)
                    .toArray();
        }

        static @Nullable Number toNumber(@Nullable Object v) {
            if (v == null) {
                return null;
            }
            if (v instanceof Number n) {
                return n;
            }
            try {
                return Double.valueOf(v.toString().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }

        /** Renders a double without a trailing {@code .0} when it is integral. */
        static String render(double x) {
            if (x == Math.rint(x) && !Double.isInfinite(x)) {
                return Long.toString((long) x);
            }
            return java.util.stream.Stream.of(x).map(String::valueOf).collect(Collectors.joining());
        }
    }
}

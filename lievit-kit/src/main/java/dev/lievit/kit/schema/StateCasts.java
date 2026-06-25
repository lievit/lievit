/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The built-in {@link StateCast}s the schema engine ships (the filament-schemas {@code StateCasts/*}
 * subset carried over): the boundary conversions a Toggle, a numeric input, a date picker, and an
 * enum select use. Each round-trips ({@code hydrate(dehydrate(x)) == x}).
 */
public final class StateCasts {

    private StateCasts() {}

    /**
     * A boolean cast: raw {@code "true"}/{@code "1"}/{@code true} hydrate to {@code true}, anything
     * else to {@code false}; dehydrates to the boolean itself (a Toggle's {@code <=>} boolean).
     *
     * @return the boolean cast
     */
    public static StateCast<Boolean> bool() {
        return new StateCast<>() {
            @Override
            public Boolean hydrate(@Nullable Object raw) {
                if (raw instanceof Boolean b) {
                    return b;
                }
                String s = raw == null ? "" : String.valueOf(raw);
                return s.equals("true") || s.equals("1") || s.equalsIgnoreCase("on");
            }

            @Override
            public Object dehydrate(@Nullable Boolean value) {
                return value != null && value;
            }
        };
    }

    /**
     * A long-number cast: raw string/number hydrates to {@code Long} (null/blank to {@code null});
     * dehydrates to a canonical decimal string so the wire carries a stable form.
     *
     * @return the number cast
     */
    public static StateCast<Long> number() {
        return new StateCast<>() {
            @Override
            public @Nullable Long hydrate(@Nullable Object raw) {
                if (raw instanceof Number n) {
                    return n.longValue();
                }
                String s = raw == null ? "" : String.valueOf(raw).trim();
                if (s.isEmpty()) {
                    return null;
                }
                return Long.parseLong(s);
            }

            @Override
            public @Nullable Object dehydrate(@Nullable Long value) {
                return value == null ? null : value.toString();
            }
        };
    }

    /**
     * An ISO {@link LocalDate} cast: raw {@code "2026-01-31"} hydrates to a {@code LocalDate};
     * dehydrates back to the ISO string. A blank/unparseable raw hydrates to {@code null}.
     *
     * @return the date cast
     */
    public static StateCast<LocalDate> date() {
        return new StateCast<>() {
            @Override
            public @Nullable LocalDate hydrate(@Nullable Object raw) {
                if (raw instanceof LocalDate d) {
                    return d;
                }
                String s = raw == null ? "" : String.valueOf(raw).trim();
                if (s.isEmpty()) {
                    return null;
                }
                try {
                    return LocalDate.parse(s);
                } catch (DateTimeParseException e) {
                    return null;
                }
            }

            @Override
            public @Nullable Object dehydrate(@Nullable LocalDate value) {
                return value == null ? null : value.toString();
            }
        };
    }

    /**
     * An ISO {@link LocalDateTime} cast (the DateTime cast): raw ISO string {@code <=>} datetime.
     *
     * @return the datetime cast
     */
    public static StateCast<LocalDateTime> dateTime() {
        return new StateCast<>() {
            @Override
            public @Nullable LocalDateTime hydrate(@Nullable Object raw) {
                if (raw instanceof LocalDateTime dt) {
                    return dt;
                }
                String s = raw == null ? "" : String.valueOf(raw).trim();
                if (s.isEmpty()) {
                    return null;
                }
                try {
                    return LocalDateTime.parse(s);
                } catch (DateTimeParseException e) {
                    return null;
                }
            }

            @Override
            public @Nullable Object dehydrate(@Nullable LocalDateTime value) {
                return value == null ? null : value.toString();
            }
        };
    }

    /**
     * An ISO {@link LocalTime} cast (the TimePicker cast): raw {@code "14:30"}/{@code "14:30:00"}
     * hydrates to a {@code LocalTime}; dehydrates back to the ISO string. Blank/unparseable to
     * {@code null}.
     *
     * @return the time cast
     */
    public static StateCast<LocalTime> time() {
        return new StateCast<>() {
            @Override
            public @Nullable LocalTime hydrate(@Nullable Object raw) {
                if (raw instanceof LocalTime t) {
                    return t;
                }
                String s = raw == null ? "" : String.valueOf(raw).trim();
                if (s.isEmpty()) {
                    return null;
                }
                try {
                    return LocalTime.parse(s);
                } catch (DateTimeParseException e) {
                    return null;
                }
            }

            @Override
            public @Nullable Object dehydrate(@Nullable LocalTime value) {
                return value == null ? null : value.toString();
            }
        };
    }

    /**
     * An enum cast: raw enum-name string {@code <=>} the enum constant. An unknown/blank name
     * hydrates to {@code null}.
     *
     * @param enumType the enum class
     * @param <E> the enum type
     * @return the enum cast
     */
    public static <E extends Enum<E>> StateCast<E> enumOf(Class<E> enumType) {
        Objects.requireNonNull(enumType, "enumType");
        return new StateCast<>() {
            @Override
            public @Nullable E hydrate(@Nullable Object raw) {
                if (enumType.isInstance(raw)) {
                    return enumType.cast(raw);
                }
                String s = raw == null ? "" : String.valueOf(raw).trim();
                if (s.isEmpty()) {
                    return null;
                }
                try {
                    return Enum.valueOf(enumType, s);
                } catch (IllegalArgumentException e) {
                    return null;
                }
            }

            @Override
            public @Nullable Object dehydrate(@Nullable E value) {
                return value == null ? null : value.name();
            }
        };
    }
}

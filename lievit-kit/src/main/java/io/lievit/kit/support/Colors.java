/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The built-in Tailwind color ramps the kit ships, so {@link ColorManager} and tests have a
 * known palette to bind semantic names to. A small curated subset of the Tailwind v4 palette
 * (the colours Filament's defaults use): the full palette is not needed in v0.1.
 */
public final class Colors {

    private Colors() {}

    private static Map<Integer, String> ramp(String... hex) {
        // hex is given in shade order 50..950; pair it with Color.SHADES.
        Map<Integer, String> out = new LinkedHashMap<>();
        for (int i = 0; i < Color.SHADES.length && i < hex.length; i++) {
            out.put(Color.SHADES[i], hex[i]);
        }
        return out;
    }

    /** Tailwind slate, the default neutral / gray ramp. */
    public static final Color SLATE =
            Color.ofRamp(
                    ramp(
                            "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b",
                            "#475569", "#334155", "#1e293b", "#0f172a", "#020617"));

    /** Tailwind blue, the default primary ramp. */
    public static final Color BLUE =
            Color.ofRamp(
                    ramp(
                            "#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6",
                            "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554"));

    /** Tailwind green, the default success ramp. */
    public static final Color GREEN =
            Color.ofRamp(
                    ramp(
                            "#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e",
                            "#16a34a", "#15803d", "#166534", "#14532d", "#052e16"));

    /** Tailwind amber, the default warning ramp. */
    public static final Color AMBER =
            Color.ofRamp(
                    ramp(
                            "#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b",
                            "#d97706", "#b45309", "#92400e", "#78350f", "#451a03"));

    /** Tailwind red, the default danger ramp. */
    public static final Color RED =
            Color.ofRamp(
                    ramp(
                            "#fef2f2", "#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ef4444",
                            "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d", "#450a0a"));

    /** Tailwind gray, an alternative neutral. */
    public static final Color GRAY =
            Color.ofRamp(
                    ramp(
                            "#f9fafb", "#f3f4f6", "#e5e7eb", "#d1d5db", "#9ca3af", "#6b7280",
                            "#4b5563", "#374151", "#1f2937", "#111827", "#030712"));
}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.time.ZoneId;
import java.util.Objects;

/**
 * The global default display timezone (the Filament {@code FilamentTimezone}/{@code
 * TimezoneManager}): date columns and date fields render instants in this zone unless overridden.
 * A small but real cross-cutting default the component enumeration skips; wired as a singleton bean
 * and reachable from the registration phase through {@link Lievit#timezone()}.
 */
public final class TimezoneManager {

    private ZoneId zone;

    private TimezoneManager(ZoneId zone) {
        this.zone = Objects.requireNonNull(zone, "zone");
    }

    /** @return a manager defaulting to UTC */
    public static TimezoneManager create() {
        return new TimezoneManager(ZoneId.of("UTC"));
    }

    /**
     * Sets the global display timezone.
     *
     * @param zoneId the zone (e.g. {@code "Europe/Rome"})
     * @return this manager
     */
    public TimezoneManager set(String zoneId) {
        this.zone = ZoneId.of(Objects.requireNonNull(zoneId, "zoneId"));
        return this;
    }

    /** @return the global display timezone */
    public ZoneId get() {
        return zone;
    }
}

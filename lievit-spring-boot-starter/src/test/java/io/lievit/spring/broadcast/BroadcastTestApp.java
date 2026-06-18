/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.broadcast;

import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Minimal Spring Boot app for the broadcast channel end-to-end test (issue #304). The
 * {@code lievit.broadcast.enabled=true} property (set on the test) makes the autoconfiguration mount
 * the {@link SseBroadcastChannel} + {@link BroadcastController} beans.
 */
@SpringBootApplication
public class BroadcastTestApp {}

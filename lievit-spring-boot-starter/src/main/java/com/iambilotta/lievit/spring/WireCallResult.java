/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

/**
 * The outcome of a successful wire call: the freshly rendered HTML fragment and the next signed
 * snapshot the client must carry into the following call (ADR-0001, wire-protocol.md phase 4).
 *
 * @param html the rendered component HTML (the 200 response body)
 * @param snapshot the next signed snapshot (the {@code Lievit-Snapshot} response header)
 */
public record WireCallResult(String html, String snapshot) {}

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

/**
 * The hello-admin row type: a minimal real-estate-agnostic record the skeleton lists. Generic on
 * purpose, the kit must work over any row type through the {@link
 * com.iambilotta.lievit.kit.RecordRepository} port.
 *
 * @param ref a stable id
 * @param city a display attribute
 */
public record Listing(long ref, String city) {}

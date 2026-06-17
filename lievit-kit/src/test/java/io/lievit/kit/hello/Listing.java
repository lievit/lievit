/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.hello;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The hello-admin row type: a minimal real-estate-agnostic record the worked CRUD example manages.
 * Generic on purpose, the kit must work over any row type through the {@link
 * io.lievit.kit.RecordRepository} port.
 *
 * <p>It carries {@code jakarta.validation} constraints so the worked example exercises submit-time
 * validation: a blank {@code city} is rejected by {@link io.lievit.kit.Form#save}.
 *
 * @param ref a stable id ({@code 0} means "assign on create")
 * @param city a display attribute, required and bounded
 */
public record Listing(long ref, @NotBlank @Size(max = 60) String city) {}

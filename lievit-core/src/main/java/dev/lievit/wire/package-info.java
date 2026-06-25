/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The stateless wire protocol: snapshot codec, HMAC-SHA-256 signing, key rotation, component ids,
 * and the error model (ADR-0001, wire-protocol.md).
 *
 * <p>This package is pure Java with zero Spring coupling (ADR-0007). It depends only on JJWT for
 * the HS256 envelope. The web layer that turns these into HTTP responses lives in the starter,
 * never here.
 */
@NullMarked
package dev.lievit.wire;

import org.jspecify.annotations.NullMarked;

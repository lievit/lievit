/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The infolists surface of lievit-kit (the filament v4 {@code infolists} package carried over onto
 * the shared schema engine): a structured, READ-ONLY display of a record, the View-page counterpart
 * of {@link io.lievit.kit.schema.SchemaForm}.
 *
 * <p>{@link io.lievit.kit.schema.infolist.Infolist} is the container; it resolves an ordered set of
 * {@link io.lievit.kit.schema.infolist.Entry}s against a record's attributes under the
 * {@link io.lievit.kit.support.EvaluationContext.Operation#VIEW} operation. Entries never dehydrate
 * and are never validated.
 *
 * <p><strong>Entries</strong>: {@link io.lievit.kit.schema.infolist.TextEntry} (text + badge / color
 * / copyable / limit / money / dateTime), {@link io.lievit.kit.schema.infolist.IconEntry} (value to
 * icon/color, the boolean-state mirror), {@link io.lievit.kit.schema.infolist.ImageEntry},
 * {@link io.lievit.kit.schema.infolist.ColorEntry}, {@link io.lievit.kit.schema.infolist.CodeEntry},
 * {@link io.lievit.kit.schema.infolist.KeyValueEntry},
 * {@link io.lievit.kit.schema.infolist.RepeatableEntry} (loops a child entry schema over a list /
 * relation, the read mirror of {@link io.lievit.kit.schema.Repeater}), and
 * {@link io.lievit.kit.schema.infolist.ViewEntry} (the custom-view escape hatch).
 */
@NullMarked
package io.lievit.kit.schema.infolist;

import org.jspecify.annotations.NullMarked;

/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lievit-kit: the admin layer ("Filament for Spring") built on the lievit wire runtime.
 *
 * <p>An in-monorepo module (ADR-0008, amended 2026-06-17), it depends on the core SPI and on the
 * Spring Boot starter, never on a persistence engine. The architecture is the distilled lesson of
 * {@code docs/research/filament-internals.md}:
 *
 * <ul>
 *   <li>{@link com.iambilotta.lievit.kit.Resource} is the unit of work, one per domain entity,
 *       <em>instance-based</em> (a Spring bean, not a static configuration namespace) so it composes
 *       with dependency injection and stays unit-testable.
 *   <li>{@link com.iambilotta.lievit.kit.Form} and {@link com.iambilotta.lievit.kit.Table}
 *       share the common parent {@link com.iambilotta.lievit.kit.Schema} from v0.1, so the
 *       builders never need a later breaking unification (the Filament v3-&gt;v4 Schema lesson).
 *   <li>{@link com.iambilotta.lievit.kit.Page} (the annotation) makes a standalone page a
 *       first-class peer of {@code Resource}, not a second-class escape hatch.
 *   <li>{@link com.iambilotta.lievit.kit.RenderHook} are named injection points: adopters
 *       extend the layout there instead of forking published views.
 *   <li>{@link com.iambilotta.lievit.kit.RecordRepository} is a persistence-agnostic port: the
 *       adopter wires the data, the kit never hard-codes JdbcClient or JPA.
 *   <li>{@link com.iambilotta.lievit.kit.Plugin} is the third-party extension point, the
 *       same {@code getId / register / boot} shape Filament uses.
 * </ul>
 *
 * <p>The CRUD spine (full-page List / Create / Edit / Delete, the Filament P0):
 *
 * <ul>
 *   <li>{@link com.iambilotta.lievit.kit.RecordRepository} carries the bounded read
 *       ({@link com.iambilotta.lievit.kit.RecordRepository.Query} +
 *       {@link com.iambilotta.lievit.kit.RecordRepository.Page}) and the write path
 *       ({@code create} / {@code update} / {@code delete}).
 *   <li>{@link com.iambilotta.lievit.kit.Form} owns the write: a
 *       {@link com.iambilotta.lievit.kit.FormBinder} maps string state to the typed record, an
 *       optional {@link com.iambilotta.lievit.kit.FormValidator} gates the save at submit time
 *       (Jakarta Bean Validation -&gt; {@link com.iambilotta.lievit.kit.FieldError}), and
 *       {@link com.iambilotta.lievit.kit.Form#save} returns a
 *       {@link com.iambilotta.lievit.kit.SaveResult}.
 *   <li>{@link com.iambilotta.lievit.kit.AdminAction} is the first-class action abstraction with
 *       the built-in {@link com.iambilotta.lievit.kit.CreateAction} /
 *       {@link com.iambilotta.lievit.kit.EditAction} /
 *       {@link com.iambilotta.lievit.kit.DeleteAction}; on success they flash an
 *       {@link com.iambilotta.lievit.kit.AdminNotification} and redirect on the lievit
 *       {@link com.iambilotta.lievit.component.LievitEffects} substrate.
 *   <li>{@link com.iambilotta.lievit.kit.AdminAuthorizer} is the write-boundary authorization seam
 *       (default {@link com.iambilotta.lievit.kit.AdminAuthorizer#permitAll()}; the host supplies
 *       a real policy).
 *   <li>{@link com.iambilotta.lievit.kit.AdminListView} / {@link com.iambilotta.lievit.kit.AdminFormView}
 *       are the render view-models; {@link com.iambilotta.lievit.kit.page.ListPageDriver} /
 *       {@link com.iambilotta.lievit.kit.page.FormPageDriver} are the reusable page logic a concrete
 *       {@code @LievitComponent} delegates to; {@link com.iambilotta.lievit.kit.ResourcePages} binds a
 *       {@link com.iambilotta.lievit.kit.Resource} to its page component classes
 *       ({@link com.iambilotta.lievit.kit.Resource#pages()}).
 *   <li>Modal / single-page CRUD is deferred to the nested-component wave (this is full-page only).
 * </ul>
 *
 * <p>Concrete field types (all extend {@link com.iambilotta.lievit.kit.Field}):
 * {@link com.iambilotta.lievit.kit.TextField},
 * {@link com.iambilotta.lievit.kit.TextareaField},
 * {@link com.iambilotta.lievit.kit.SelectField} (static option set, uses
 * {@link com.iambilotta.lievit.kit.SelectOption}),
 * {@link com.iambilotta.lievit.kit.ToggleField},
 * {@link com.iambilotta.lievit.kit.DateField}.
 * Relation fields: {@link com.iambilotta.lievit.kit.BelongsToField} (options from a repository),
 * {@link com.iambilotta.lievit.kit.HasManyField} (read-only display via a loader supplier).
 *
 * <p>Concrete column types (all extend {@link com.iambilotta.lievit.kit.Column}):
 * {@link com.iambilotta.lievit.kit.TextColumn} (plain text, sortable flag),
 * {@link com.iambilotta.lievit.kit.BadgeColumn} (styled badge with optional colour mapper),
 * {@link com.iambilotta.lievit.kit.BooleanColumn} (renders icon names for true/false),
 * {@link com.iambilotta.lievit.kit.DateColumn} (temporal value with optional formatter pattern).
 *
 * <p>Widget layer: {@link com.iambilotta.lievit.kit.Widget} (interface),
 * {@link com.iambilotta.lievit.kit.StatWidget} (key-metric card with lazy value supplier),
 * {@link com.iambilotta.lievit.kit.WidgetPage} (dashboard page hosting widgets, registered on a
 * panel via {@link com.iambilotta.lievit.kit.Panel#page(WidgetPage)}).
 */
@NullMarked
package com.iambilotta.lievit.kit;

import org.jspecify.annotations.NullMarked;

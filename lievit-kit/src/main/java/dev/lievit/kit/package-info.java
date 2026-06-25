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
 *   <li>{@link dev.lievit.kit.Resource} is the unit of work, one per domain entity,
 *       <em>instance-based</em> (a Spring bean, not a static configuration namespace) so it composes
 *       with dependency injection and stays unit-testable.
 *   <li>{@link dev.lievit.kit.Form} and {@link dev.lievit.kit.Table}
 *       share the common parent {@link dev.lievit.kit.Schema} from v0.1, so the
 *       builders never need a later breaking unification (the Filament v3-&gt;v4 Schema lesson).
 *   <li>{@link dev.lievit.kit.Page} (the annotation) makes a standalone page a
 *       first-class peer of {@code Resource}, not a second-class escape hatch.
 *   <li>{@link dev.lievit.kit.RenderHook} are named injection points: adopters
 *       extend the layout there instead of forking published views.
 *   <li>{@link dev.lievit.kit.RecordRepository} is a persistence-agnostic port: the
 *       adopter wires the data, the kit never hard-codes JdbcClient or JPA.
 *   <li>{@link dev.lievit.kit.Plugin} is the third-party extension point, the
 *       same {@code getId / register / boot} shape Filament uses.
 * </ul>
 *
 * <p>The CRUD spine (full-page List / Create / Edit / Delete, the Filament P0):
 *
 * <ul>
 *   <li>{@link dev.lievit.kit.RecordRepository} carries the bounded read
 *       ({@link dev.lievit.kit.RecordRepository.Query} +
 *       {@link dev.lievit.kit.RecordRepository.Page}) and the write path
 *       ({@code create} / {@code update} / {@code delete}).
 *   <li>{@link dev.lievit.kit.Form} owns the write: a
 *       {@link dev.lievit.kit.FormBinder} maps string state to the typed record, an
 *       optional {@link dev.lievit.kit.FormValidator} gates the save at submit time
 *       (Jakarta Bean Validation -&gt; {@link dev.lievit.kit.FieldError}), and
 *       {@link dev.lievit.kit.Form#save} returns a
 *       {@link dev.lievit.kit.SaveResult}.
 *   <li>{@link dev.lievit.kit.AdminAction} is the first-class action abstraction with
 *       the built-in {@link dev.lievit.kit.CreateAction} /
 *       {@link dev.lievit.kit.EditAction} /
 *       {@link dev.lievit.kit.DeleteAction}; on success they flash an
 *       {@link dev.lievit.kit.AdminNotification} and redirect on the lievit
 *       {@link dev.lievit.component.LievitEffects} substrate.
 *   <li>{@link dev.lievit.kit.AdminAuthorizer} is the write-boundary authorization seam
 *       (default {@link dev.lievit.kit.AdminAuthorizer#permitAll()}; the host supplies
 *       a real policy).
 *   <li>{@link dev.lievit.kit.AdminListView} / {@link dev.lievit.kit.AdminFormView}
 *       are the render view-models; {@link dev.lievit.kit.page.ListPageDriver} /
 *       {@link dev.lievit.kit.page.FormPageDriver} are the reusable page logic a concrete
 *       {@code @LievitComponent} delegates to; {@link dev.lievit.kit.ResourcePages} binds a
 *       {@link dev.lievit.kit.Resource} to its page component classes
 *       ({@link dev.lievit.kit.Resource#pages()}).
 *   <li>Modal / single-page CRUD is deferred to the nested-component wave (this is full-page only).
 * </ul>
 *
 * <p>Concrete field types (all extend {@link dev.lievit.kit.Field}):
 * {@link dev.lievit.kit.TextField},
 * {@link dev.lievit.kit.TextareaField},
 * {@link dev.lievit.kit.SelectField} (static option set, uses
 * {@link dev.lievit.kit.SelectOption}),
 * {@link dev.lievit.kit.ToggleField},
 * {@link dev.lievit.kit.DateField}.
 * Relation fields: {@link dev.lievit.kit.BelongsToField} (options from a repository),
 * {@link dev.lievit.kit.HasManyField} (read-only display via a loader supplier).
 *
 * <p>Concrete column types (all extend {@link dev.lievit.kit.Column}):
 * {@link dev.lievit.kit.TextColumn} (plain text, sortable flag),
 * {@link dev.lievit.kit.BadgeColumn} (styled badge with optional colour mapper),
 * {@link dev.lievit.kit.BooleanColumn} (renders icon names for true/false),
 * {@link dev.lievit.kit.DateColumn} (temporal value with optional formatter pattern).
 *
 * <p>Widget layer: {@link dev.lievit.kit.Widget} (interface),
 * {@link dev.lievit.kit.StatWidget} (key-metric card with lazy value supplier),
 * {@link dev.lievit.kit.WidgetPage} (dashboard page hosting widgets, registered on a
 * panel via {@link dev.lievit.kit.Panel#page(WidgetPage)}).
 *
 * <p>Heavyweight subsystems (their own subpackages, all opt-in, built on the persistence-agnostic
 * floor so they cost a non-user nothing):
 *
 * <ul>
 *   <li>{@link dev.lievit.kit.job} the chunked async-job primitive (runner port + chunked job +
 *       progress/failed-rows + store) the import/export actions ride.
 *   <li>{@link dev.lievit.kit.importer} CSV import ({@code Importer} + {@code ImportAction}: upload,
 *       header mapping, chunked validate/cast/persist, failed-rows report).
 *   <li>{@link dev.lievit.kit.exporter} CSV/XLSX export ({@code Exporter} + {@code ExportAction} /
 *       {@code ExportBulkAction}: column selection, chunked write, download notification).
 *   <li>{@link dev.lievit.kit.tenancy} multi-tenancy (tenant model, per-resource query scoping,
 *       {@code canAccessTenant}, tenant switcher), turned on per panel via
 *       {@link dev.lievit.kit.Panel#tenancy(dev.lievit.kit.tenancy.Tenancy)}.
 *   <li>{@link dev.lievit.kit.cluster} clusters (group resources/pages under a shared prefix +
 *       sub-navigation), registered via {@link dev.lievit.kit.Panel#cluster(dev.lievit.kit.cluster.Cluster)}.
 *   <li>{@link dev.lievit.kit.settings} schema-driven settings pages over a settings store.
 * </ul>
 */
@NullMarked
package dev.lievit.kit;

import org.jspecify.annotations.NullMarked;

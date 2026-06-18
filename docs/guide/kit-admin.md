# The lievit-kit admin

`lievit-kit` is the admin layer: a fluent, type-safe DSL for declaring a CRUD back office —
**Resource**, **Form**, **Table**, **Action**, **Panel** — the Filament category for Spring. It is
content (an excellent admin), not a framework: instance-based, dependency-injection-friendly, and
**persistence-agnostic**.

> **What the kit gives you, and what you wire.** lievit-kit produces typed **view-models**
> (`AdminListView`, `AdminFormView`) and the building blocks above. It ships **no HTTP controllers**:
> the adopter wires a controller that reads the view-model and renders it with a template, and points
> the wire endpoint and routes at it. This is deliberate (you own routing, templates, and the data
> port). The [CRUD admin example](../../examples/kit-crud-admin/) shows the full wiring end to end.

Add the module:

```xml
<dependency>
    <groupId>com.github.lievit.lievit</groupId>
    <artifactId>lievit-kit</artifactId>
    <version>main-SNAPSHOT</version>
</dependency>
```

## The data port: `RecordRepository<T>`

The kit reads and writes rows only through a `RecordRepository<T>`, never a hard-coded `JdbcClient`
or JPA repository, so the same admin works over JDBC, JPA, an HTTP backend, or an in-memory list. The
read is **bounded**: the list page reads a single `Page` through `page(Query)`, never the whole table.

```java
public interface RecordRepository<T> {
    Page<T> page(Query query);             // one bounded page (offset + limit + total)
    Optional<T> findById(String id);
    T create(T record);
    T update(String id, T record);
    void delete(String id);
    List<T> findAll();                     // default: small relations / option lists only
}
```

`SoftDeleteRepository<T>` extends it with `restore(id)`, `forceDelete(id)`, `isTrashed(record)`.

## A Resource

A `Resource<T>` declares a slug, a label, a table, and (optionally) a form. It takes its repository by
constructor injection, so it is a normal Spring bean:

```java
public class ListingResource extends Resource<Listing> {

    public ListingResource(RecordRepository<Listing> repository) {
        super(repository);
    }

    @Override public String slug()  { return "listings"; }
    @Override public String label() { return "Listings"; }

    @Override
    public Table<Listing> table() {
        return Table.<Listing>create()
            .id(l -> String.valueOf(l.id()))
            .column(TextColumn.make("Ref", Listing::ref).makeSortable().searchable())
            .column(TextColumn.make("City", Listing::city).makeSortable())
            .column(BadgeColumn.make("Status", Listing::status)
                .color(s -> "draft".equals(s) ? "grey" : "green"))
            .filters(SelectFilter.make("status")
                .options(Map.of("draft", "Draft", "published", "Published")))
            .defaultSort("city", SortDirection.ASC)
            .paginationPageOptions(10, 25, 50);
    }

    @Override
    public Form<Listing> form() {
        return Form.<Listing>create()
            .field(TextField.make("ref", "Reference"))
            .field(TextField.make("city", "City"))
            .field(SelectField.make("status", List.of(
                SelectOption.of("draft", "Draft"),
                SelectOption.of("published", "Published"))))
            .binder(new ListingBinder())
            .validator(new FormValidator(validator));
    }
}
```

## Forms: the field palette

`Form<T>` is an ordered list of fields plus a binder and an optional validator:

| Field | Builder | Notes |
|---|---|---|
| Text | `TextField.make(name, label)` | single-line input |
| Textarea | `TextareaField.make(name).rows(5)` | multi-line |
| Select | `SelectField.make(name, options)` | static option list |
| Toggle | `ToggleField.make(name).onLabel("Yes").offLabel("No")` | boolean |
| Date | `DateField.make(name).format("dd/MM/yyyy")` | date picker |
| BelongsTo | `BelongsToField.make(name, repo, R::id, R::name)` | dynamic select from a related repo |

`form.field("email")` (a bare name) humanizes the label ("Email"). A form **without a binder is
read-only** (it cannot save).

### The write path

A `FormBinder<T>` translates between form state (`Map<String, String>`) and the row type. Saving runs
the binder, validates, and persists:

```java
SaveResult<T> result = form.save(repository, editId, state);   // editId == null → create
if (result.ok()) {
    T persisted = result.record();
} else {
    List<FieldError> errors = result.errors();   // surface them in the form view
}
```

```java
// lievit-kit test: FormSaveTest — a valid create persists one row
SaveResult<Account> result = form.save(repo, null, Map.of("name", "Ada"));
// result.ok() == true; the repo holds one row
```

## Tables: the column palette

`Table<T>` declares an id extractor, columns, optional filters, grouping, and pagination. Columns:

| Column | Builder |
|---|---|
| Text | `TextColumn.make(label, T::accessor)` — `.makeSortable()`, `.searchable()`, `.money("EUR")`, `.limit(50)`, `.url(...)`, `.copyable()`, `.formatStateUsing(...)` |
| Badge | `BadgeColumn.make(label, accessor).color(v -> ...)` |
| Boolean | `BooleanColumn.make(label, accessor).trueIcon(...).falseIcon(...)` |
| Date | `DateColumn.make(label, accessor).format("dd/MM/yyyy")` |
| Image / Icon / Tags / Color | `ImageColumn`, `IconColumn`, `TagsColumn`, `ColorColumn` |
| Editable | `ToggleColumn`, `TextInputColumn`, `EditableColumn` (inline edit) |

```java
// lievit-kit test: TableTest — the declared id function derives a row id
Table.<Listing>create().id(l -> String.valueOf(l.ref())).column("City", Listing::city)
    .idOf(new Listing(42, "Reggio"));   // "42"
```

### Filters, grouping, summaries, soft-delete

- **Filters**: `Filter` (boolean), `SelectFilter` (`.multiple()`), `TernaryFilter` (true/false/all),
  `TrashedFilter` (soft-delete scope). The repository reads `FilterState` to apply the WHERE clause.
- **Grouping**: `Group.make(name, accessor).label(...).collapsible(true)`; `group.partition(rows)`
  splits rows into sections, preserving sort order.
- **Summaries**: `column.summarize(Summarizer.count() / sum() / average())` for footer/group totals.
- **Reordering**: `.reorderable("sort_order")` for drag-to-reorder (paired with `l:sort`).

```java
// lievit-kit test: TableFilterTest — a trashed filter resolves a soft-delete scope
TrashedFilter.make().scope(FilterState.EMPTY);   // WITHOUT_TRASHED (default)
```

## Actions

An `AdminAction<T>` is a named operation with presentation (icon, color, size, variant, tooltip,
badge) and authorization (every action gates through `AdminAuthorizer.isAllowed(operation, resource,
record)`; `AdminOperation` is CREATE/UPDATE/DELETE/FORCE_DELETE/RESTORE/VIEW). Built-ins:

| Action | What |
|---|---|
| `new CreateAction<>(form)` | validate + persist a new record, flash, redirect |
| `new EditAction<>(form)` | validate + persist changes |
| `new DeleteAction<>()` | soft-delete (requires confirmation, `isDestructive()`) |
| `RestoreAction` / `ForceDeleteAction` | for soft-deleted rows |
| `BulkAction.make(name, label, op, (records, ctx) -> ...)` | over the selected rows |
| `FormAction.make(name, label, op, form, (record, ctx) -> ...)` | a modal with a form |

```java
// lievit-kit test: FormActionTest — valid form data reaches the process body
FormAction<Message> action = FormAction.make(
    "send", "Send", AdminOperation.UPDATE, form, (record, ctx) -> { /* process */ });
AdminActionResult result = tester.callAction(action, null, Map.of("to", "ada@x", "subject", "Hi"));
tester.assertActionCompleted(result);
```

A custom action overrides `perform(AdminActionContext<T>)` and returns an `AdminActionResult`
(`.completed(redirectUrl)` / `.invalid(fieldErrors)` / `.forbidden()`). Override
`requiresConfirmation()` for a confirmation modal.

## Infolists (read-only view)

For a record's detail page, an `Infolist` resolves entries against a record:

```java
Infolist.make()
    .schema(TextEntry.make("email"), IconEntry.make("status"), KeyValueEntry.make("metadata"))
    .columns(2);
```

Entry palette: `TextEntry`, `IconEntry`, `ImageEntry`, `ColorEntry`, `CodeEntry`, `KeyValueEntry`,
`RepeatableEntry`, `ViewEntry`, each with `.placeholder(...)`, `.visible(...)`,
`.formatStateUsing(...)`.

## Panels

A `Panel` groups resources under a route prefix and carries the chrome (brand, theme, navigation,
dashboard widgets, database notifications, plugins):

```java
Panel.create("admin")
    .path("admin")
    .resource(new ListingResource(listingRepo))
    .brandName("Acme")
    .primaryColor(Color.PRIMARY)
    .darkMode(true).defaultThemeMode(ThemeMode.SYSTEM)
    .databaseNotifications();
```

```java
// lievit-kit test: PanelTest — registers a resource under a named panel
Panel panel = Panel.create("admin").resource(resource);
panel.id();          // "admin"
panel.resources();   // [resource]
```

Resource routes follow the Filament shape (`AdminRoutes`): `/{panel}/{slug}` (list),
`/{panel}/{slug}/create`, `/{panel}/{slug}/{id}/edit`. A `Plugin` registers via `panel.plugin(p)`
(register → boot lifecycle); render hooks inject HTML at named points (`RenderHook.CONTENT_BEFORE`,
`BODY_END`, ...).

## Component-wide defaults

`ComponentConfiguration` registers closures that mutate every instance of a field/column type at
construction, so an app says once "every text field defaults to maxlength 255" without subclassing
(`configureUsing` / `configureImportant` / scoped `during`).

## Rendering it: the view-models

A controller turns a resource into a view-model and renders it:

```java
// list page
AdminListView view = AdminListView.of(resource, page, pageSize);
// view.heading(), view.headers(), view.rows() (each row.id() + row.cells()),
// view.pagination() (page / totalPages / hasPrevious / hasNext), view.controls()

// create / edit page
AdminFormView form = AdminFormView.of(resource.form(), editing, currentValues, submitErrors);
// form.heading(), form.editing(), form.fields() (each name / label / type / value / errors),
// form.recordErrors()
```

```java
// lievit-kit test: AdminListViewTest — a bounded page of rows with headers
AdminListView view = AdminListView.of(resourceOf(repoOf(5)), 2, 2);   // page 2, size 2
view.headers();                              // ["Name"]
view.rows();                                 // ids "3", "4" — only this window
view.pagination().totalPages();              // 3
```

You iterate the view-model in your own JTE template and stamp the row / create / delete actions
against `AdminRoutes`. The [CRUD admin example](../../examples/kit-crud-admin/) is a complete,
runnable wiring.

## Not in v0.1 (roadmap)

Relation fields beyond `BelongsToField` (`HasMany` / `BelongsToMany`), broadcast notifications,
import/export, and multi-tenancy are deferred to later modules. The shipped surface is the
single-resource CRUD admin with forms, tables, filters, grouping, soft-delete, actions, infolists,
panels, dashboard widgets, and database notifications.

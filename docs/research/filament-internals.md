# Filament internals: architecture study for "Filament for Spring"

**Source:** `filamentphp/filament` branch `4.x`, read via GitHub API (git clone fails on
this machine; all citations are from the live repo). Date: 2026-06-17.
**Purpose:** inform a future "Filament for Spring" admin layer built on the lievit runtime
(ADR-0008: separate repo, deferred, its own release cadence).

---

## 1. Architecture: the three-layer cake

```
filament/panels        ← panel builder, Resource, Page, navigation, auth, tenancy
filament/forms         ← form builder
filament/tables        ← table builder
filament/infolists     ← read-only detail view builder
filament/actions       ← Action + ActionGroup (shared across all builders)
filament/notifications ← flash + DB notification UI
filament/schemas       ← v4 unifying container (Form, Table, Infolist all become Schema)
filament/support       ← base Component, Blade UI components, Heroicons, assets, theming
filament/widgets       ← dashboard widgets
```

**`filament/support` is the foundation.**
`packages/support/src/Components/Component.php:9-11` — the base abstract `Component` that
every builder node, every schema, every action, and every panel concern extends:

```php
abstract class Component
{
    use Conditionable;   // ->when()
    use Configurable;    // configure() hook called by make()
    use EvaluatesClosures;
    use Macroable;
    use Tappable;
}
```

`Macroable` is the escape hatch for external extension without subclassing.
`EvaluatesClosures` is what lets every argument accept `Closure` instead of a literal value,
making the builder API lazily evaluated.

---

## 2. The Panel builder

A **Panel** is a named, independently configurable admin surface.
One Laravel app can run multiple panels (e.g. `admin`, `app`, `customer-portal`).

**Registration** (`packages/panels/src/PanelProvider.php:1-12`):

```php
abstract class PanelProvider extends ServiceProvider
{
    abstract public function panel(Panel $panel): Panel;

    public function register(): void
    {
        Filament::registerPanel(
            fn (): Panel => $this->panel(Panel::make()),
        );
    }
}
```

Every developer extends `PanelProvider`, overrides `panel()`, and fluently configures the
panel. The panel is resolved lazily via a closure so Laravel's IoC container is available.

**The Panel class** (`packages/panels/src/Panel.php`) assembles ~35 traits, each owning
one concern:

| Concern trait | What it owns |
|---|---|
| `HasComponents` | `resources()`, `pages()`, `widgets()`, `discoverResources(string $in, string $for)` |
| `HasRenderHooks` | `renderHook(string $name, Closure $hook)` — 40+ named injection points |
| `HasTheme` | `theme()`, `viteTheme()`, `getDefaultTheme()` |
| `HasColors` | `colors([])` — Tailwind CSS custom-property mapping |
| `HasNavigation` | navigation groups, items, sorting |
| `HasAuth` | auth guard, login/logout page overrides |
| `HasTenancy` | multi-tenant scoping via an Eloquent model |
| `HasPlugins` | `plugin(Plugin $plugin)` — third-party extension point |

`PanelRegistry` (`packages/panels/src/PanelRegistry.php`) is a singleton that holds all
registered panels and resolves the default one.

**Resource auto-discovery** (`packages/panels/src/Panel/Concerns/HasComponents.php`
method `discoverResources`): scans a directory for classes extending `Resource`, registers
them, and wires Livewire components. Explicit `resources([...])` registration is also
supported.

---

## 3. "Everything is a Resource"

The Resource is the central abstraction for a model-backed CRUD section.

**Base class** (`packages/panels/src/Resources/Resource.php`):

```php
abstract class Resource
{
    use Macroable;
    use Resource\Concerns\BelongsToCluster;
    use Resource\Concerns\BelongsToParent;
    use Resource\Concerns\BelongsToTenant;
    use Resource\Concerns\CanGenerateUrls;
    use Resource\Concerns\HasAuthorization;
    use Resource\Concerns\HasBreadcrumbs;
    use Resource\Concerns\HasConfiguration;
    use Resource\Concerns\HasGlobalSearch;
    use Resource\Concerns\HasLabels;
    use Resource\Concerns\HasNavigation;
    use Resource\Concerns\HasPages;
    use Resource\Concerns\HasRoutes;

    protected static ?string $model = null;   // Eloquent model class-string

    public static function form(Schema $schema): Schema     { return $schema; }
    public static function infolist(Schema $schema): Schema { return $schema; }
    public static function table(Table $table): Table       { return $table; }
}
```

Everything about a Resource is **static**: model binding, labels, navigation, pages, routes,
authorization. There are no instance methods; the class is a configuration namespace, not a
service object.

**The five CRUD pages** (from `packages/panels/src/Resources/Pages/`):

| Class | Route | Purpose |
|---|---|---|
| `ListRecords` | `GET /resource` | Table with pagination, search, filters |
| `CreateRecord` | `GET /resource/create` | Form for creating a new record |
| `EditRecord` | `GET /resource/{record}/edit` | Form for editing an existing record |
| `ViewRecord` | `GET /resource/{record}` | Read-only infolist view |
| `ManageRecords` | `GET /resource` | Single-page CRUD (modal create/edit on top of list) |

A resource declares which pages it exposes via `getPages()`:

```php
public static function getPages(): array
{
    return [
        'index'  => Pages\ListRecords::route('/'),
        'create' => Pages\CreateRecord::route('/create'),
        'edit'   => Pages\EditRecord::route('/{record}/edit'),
    ];
}
```

`HasPages` (`packages/panels/src/Resources/Resource/Concerns/HasPages.php`) is a minimal
two-method trait: `getPages()` and `hasPage(string $page)`. The route wiring lives in
`HasRoutes` which calls `Route::group()` per resource using the page array.

**Model derivation** (`packages/panels/src/Resources/Resource.php:84-88`):
if `$model` is not declared, Filament infers it by stripping the `Resource` suffix and
prepending `App\Models\`. `PostResource` → `App\Models\Post`.

**Navigation** (`packages/panels/src/Resources/Resource/Concerns/HasNavigation.php`):
`registerNavigationItems()` checks authorization, skips clustered/parented resources, then
calls `panel->navigationItems()`. Each resource becomes one `NavigationItem`.

---

## 4. The Schema / Form / Table / Infolist / Actions builders

### v4: everything converges on Schema

In v3 there were separate `Form` and `Infolist` builders. v4 unifies them under a single
`Schema` class (`packages/schemas/src/Schema.php`), which holds an array of `Component`
objects. `Form`, `Table`, and `Infolist` are now `Schema` subtypes or schema components.

`Schema` itself extends `ViewComponent` (from `filament/support`) and accumulates ~20
concerns: `HasComponents`, `HasState`, `HasColumns`, `HasGap`, `CanBeValidated`, `CanBeHidden`,
`BelongsToModel`, `BelongsToLivewire`, etc.

Every field, column, entry, and layout node extends `Component`. Common concerns:
`EvaluatesClosures` (any argument can be a closure), `Macroable` (add methods without
subclassing), `Configurable` (a `configure()` hook), `Conditionable` (`->when()`/`->unless()`).

### Form components (`packages/forms/src/Components/`)

`TextInput`, `Select`, `DatePicker`, `FileUpload`, `Repeater`, `Builder` (nested block
editor), `RichEditor`, `KeyValue`, `Toggle`, `Checkbox`, `CheckboxList`, `Radio`,
`Hidden`, `Placeholder`, `CodeEditor`, and more — each a concrete `Field` extending
`Component`. Fields are stateful via `HasState`; they bind to Livewire's data store.

### Table columns (`packages/tables/src/Columns/`)

`TextColumn`, `BadgeColumn`, `BooleanColumn`, `IconColumn`, `ImageColumn`, `SelectColumn`
(inline editing), `ToggleColumn` (inline editing), `CheckboxColumn`, `TagsColumn`,
`ColorColumn`, `ViewColumn` (escape hatch). All extend `Column` → `Component`.

### Actions (`packages/actions/src/Action.php`)

`Action` extends `ViewComponent` and renders itself as button, icon-button, link, or dropdown
item depending on context. It carries:
- `action(Closure)` — what to run on the server
- `form()` — optional Schema mounted inside a slide-over or modal
- `requiresConfirmation()` — modal confirmation
- `authorize(Closure)` — fine-grained gate

Actions are composable: an action can open a form inside a modal, which can trigger another
action. `ActionGroup` stacks them in a dropdown.

---

## 5. Component model: Blade + Tailwind + Alpine.js

### Blade anonymous components (filament/support)

UI components are in `packages/support/resources/views/components/`:
`badge`, `button`, `callout`, `card`, `dropdown`, `fieldset`, `icon`, `icon-button`,
`input/*`, `link`, `modal`, `pagination`, `section`, `tabs`, `toggle`.

They are registered as `x-filament::*` Blade components by the `SupportServiceProvider`.
Every interactive one (`dropdown`, `modal`, `tabs`) is wired to Alpine.js.

### Tailwind v4 preset

`packages/panels/resources/css/theme.css`:

```css
@import 'tailwindcss' source(none);   /* Tailwind v4 bare import */
@import './index.css';
```

`index.css` chains imports from all packages (support, actions, forms, infolists,
notifications, schemas, tables, widgets) and declares `@theme inline` tokens for
`--font-sans`, `--font-mono`, `--font-serif`. Colors are CSS custom properties registered
by `FilamentColor::register()` at panel boot. This means theming is done by:
1. Overriding CSS variables in `@theme inline`.
2. Providing a custom CSS file via `panel->theme()` or `panel->viteTheme()`.

The compiled CSS lives in `dist/` per package. Users do **not** run a Tailwind build for
Filament itself; they only run one if they publish and modify the theme.

### Alpine.js

All client interactivity (dropdowns, modals, popovers, sort handles, date pickers) is
Alpine.js. No Vue, no React, no Livewire-specific JS beyond the Livewire payload. Alpine
components are registered in `packages/support/resources/js/components/` and bundled via
esbuild (`bin/build.js`).

### Heroicons

`packages/support/src/Icons/Heroicon.php` is a PHP `enum` of every Heroicon slug.
Icons are resolved by `FilamentIcon::register()` at panel boot and rendered via
`blade-ui-kit/blade-heroicons`. Icons are swappable per-panel via `panel->icons([])`.

---

## 6. Render hooks: the extension surface

Filament defines 40+ named injection points (string constants in
`packages/panels/src/View/PanelsRenderHook.php`):

```php
const BODY_START          = 'panels::body.start';
const CONTENT_BEFORE      = 'panels::content.before';
const CONTENT_AFTER       = 'panels::content.after';
const HEAD_END            = 'panels::head.end';
const SIDEBAR_NAV_START   = 'panels::sidebar.nav.start';
const PAGE_START          = 'panels::page.start';
const PAGE_END            = 'panels::page.end';
// ... 33 more
```

A plugin or panel config registers a closure:

```php
$panel->renderHook(PanelsRenderHook::CONTENT_BEFORE, fn () => view('my-banner'))
```

This is the primary customization surface that does not require overriding a Blade view.

---

## 7. Customization and escape hatches

### Publishing views (last resort)

Any Blade view can be published with `artisan vendor:publish`. But published views are
disconnected from upgrades: every major release ships with view changes, and a published
view stays on the old markup. Filament explicitly warns that published views require manual
updates on upgrade. This is the most fragile escape hatch.

### Custom Pages

Any class extending `Page` (which extends `BasePage extends Livewire\Component`) that is
registered with the panel is a full Livewire component with a Blade view you own entirely.
`packages/panels/src/Pages/BasePage.php:52-58`:

```php
public function render(): View
{
    return view($this->getView(), $this->getViewData())
        ->layout($this->getLayout(), [...]);
}
```

Override `getView()` to point at your own Blade file. This is a clean escape: you get the
panel layout (sidebar, header, navigation) but write the page body yourself.

### Custom Resource Pages

A Resource's `getPages()` can point to any `Page` subclass. Replacing `CreateRecord` with
a bespoke page is fully supported and the documented escape for non-standard create flows.

### Plugins (`Contracts/Plugin.php`)

```php
interface Plugin
{
    public function getId(): string;
    public function register(Panel $panel): void;
    public function boot(Panel $panel): void;
}
```

A plugin gets a reference to the Panel at register and boot time; it can add resources,
pages, widgets, render hooks, navigation items, or theme overrides. This is the clean
extension point for library authors.

### Macros

Every `Component` mixes in `Macroable`. Third-party packages add methods to any builder
node without subclassing. Common pattern in the ecosystem: `TextColumn::macro('...)`.

---

## 8. Where Filament bends well vs fights you

### Bends well

- **CRUD for Eloquent models.** List + create + edit + view + delete wired in 30 lines.
  Pagination, search, sort, filters, bulk actions are default-on.
- **Multi-panel apps.** Separate admin/app panels with separate auth, navigation, and theme
  in one Laravel install.
- **Relation management.** `RelationManager` and `ManageRelatedRecords` handle nested
  one-to-many and many-to-many out of the box.
- **Dashboard widgets.** Stats, charts, and table widgets drop into `getWidgets()`.
- **Global search.** One `$globallySearchable = true` flag on a resource wires it into
  the panel search overlay.
- **Authorization.** Gates and policies are checked at the Resource level; every page calls
  `authorizeAccess()` on mount.

### Fights you

- **Non-CRUD UX.** A wizard, a kanban board, a timeline, any screen that doesn't map to
  "table of records + form to edit one" requires a custom Page and full Livewire component.
  The builder buys nothing there.
- **Bespoke form layouts.** The grid/section/fieldset layout system is powerful but opinionated.
  Complex multi-column layouts with conditional visibility and cross-field logic can produce
  deeply nested schema closures that are hard to read and test.
- **Non-Eloquent data.** `getEloquentQuery()` is the data contract. Plugging in an API
  backend or a read-only view requires overriding the query, the model label, and several
  authorization methods. It works, but the friction is real.
- **Page-within-a-page composition.** Livewire's component isolation means you cannot
  trivially embed one Filament page inside another; you use widgets or custom Livewire
  components rendered via `<livewire:...>` in a custom page view.

---

## 9. Upgrade churn: v2 → v3 → v4

The `packages/upgrade/` package ships Rector rules that mechanically apply the breaking
changes. Examining `SimplePropertyChangesRector.php` and `SimpleMethodChangesRector.php`:

**v3 → v4 breaking changes (sampled):**

- `form(Form $form)` → `form(Schema $schema)` everywhere a Form or Infolist was accepted.
  `RenameSchemaParamToMatchTypeRector.php` renames every parameter named `$form`/`$infolist`
  to `$schema` and retypes it. This touches every Resource that declared `form()` or
  `infolist()`.
- `view` property changed from static to instance on `BasePage`, `RelationManager`, `Widget`.
- `maxWidth` type changed to `Width|string|null` on `SimplePage` and `EditProfile`.
- Several navigation icon properties changed to `string|BackedEnum|null` (supporting
  the `Heroicon` enum introduced in v4).
- Panel route methods now receive an explicit `Panel $panel` parameter.
- Blade component HTML changed in multiple places, invalidating published views.

**v2 → v3** was an even larger break: complete rewrite of the form and table builders,
new package structure, new Livewire 3 requirement. Most v2 code was non-mechanically
non-upgradeable.

The pattern: **Filament ships feature-complete major versions on a roughly annual cadence,
with breaking changes that touch every Resource and every view override.** The Rector
automation reduces the pain but does not eliminate it. Published views are the worst
casualty: every HTML change in a published view must be manually reconciled.

**Lesson for "Filament for Spring":** design the customization surface so that adopters
rarely need to fork the HTML. Render hooks beat published views.

---

## 10. Mapping to "Filament for Spring" on lievit

### Stack mapping

| Filament (PHP/Laravel) | "Filament for Spring" (Java/Spring) |
|---|---|
| Blade templates | JTE templates |
| Alpine.js | lievit client (same idiom: `l:click`, `l:model`) |
| Livewire | lievit runtime (wire protocol, HMAC snapshot, ADR-0001) |
| Tailwind v4 | Tailwind v4 (same; lievit-ui copy-in tokens) |
| Heroicons | Heroicons (same SVG, register via lievit-ui registry) |
| `filament/support` Blade components | lievit-ui Lit components / JTE partials |
| `Panel` builder | `AdminPanel` Spring configuration DSL |
| `Resource` abstract class | `AdminResource<T>` abstract class |
| `Schema` (Form/Table/Infolist) | `AdminForm<T>`, `AdminTable<T>`, `AdminInfolist<T>` |
| `Action` | `AdminAction` |
| Eloquent query | Spring `JdbcClient` / `JpaRepository` port |
| `PanelProvider` (Laravel ServiceProvider) | Spring `@Configuration` with `@Bean AdminPanel` |
| `Plugin` interface | `AdminPanelPlugin` interface |
| `make:filament-resource` artisan | `./mvnw generate` or CLI (`lievit-admin add resource`) |

### What to carry over

**1. Resource as the unit of work.**
One class per domain entity, with `form()`, `table()`, `infolist()` methods that build
the three views from a type-safe fluent DSL. The static-class approach works for Java too:
make them Spring `@Component`s discovered by annotation scanning.

**2. Page-based escape hatch.**
Any `@LievitComponent` can serve as a custom page. Register it with the admin panel under a
route slug. The lievit wire runtime already provides the component lifecycle
(`@LievitMount`, `@LievitAction`); the admin panel adds navigation + layout wrapping.

**3. Render hooks (named injection points).**
A fixed set of `String` constants (e.g. `AdminRenderHook.CONTENT_BEFORE`) registered at panel
boot. Adopters insert JTE partials at hooks without touching the layout template.
Beats Filament's "publish views and hand-merge forever".

**4. Plugin interface.**
`AdminPanelPlugin` with `register(AdminPanel panel)` and `boot(AdminPanel panel)`.
The same two methods Filament uses; this is the right size.

**5. Action as a first-class object.**
Actions that carry their own form (for modal workflows) are a genuine power feature.
Model it: `AdminAction.builder()... .form(...) .handle(ctx -> ...)`.

**6. Separate release cadence (the Livewire/Filament lesson).**
ADR-0008 already locks this: admin is a separate repository from lievit-core.
This lets the runtime (lievit) iterate on protocol and security independently of the admin
UI, and lets the admin iterate on CRUD conventions without breaking runtime adopters.

### What NOT to carry over

**1. "Everything is a Resource" rigidity.**
Filament forces every admin section through the Resource abstraction. Dashboard pages,
settings pages, one-off tools — all need the Resource scaffolding or a custom Page escape.
For "Filament for Spring", make `AdminResource` optional: a `@AdminPage` standalone component
should be a peer citizen, not a second-class escape hatch.

**2. Static-only methods on Resource.**
PHP's static methods work well with Laravel's runtime class introspection. In Java, statics
are harder to test and don't compose well with Spring DI. Use instance methods with
`@Component` injection; the fluent builder DSL handles configuration.

**3. Published Blade views as customization surface.**
Never the primary customization surface. JTE templates in lievit-ui are copy-in (shadcn
model, ADR-0009); for admin layout, use render hooks + JTE params, not "publish and fork".

**4. Implicit Eloquent coupling.**
Filament's entire data path assumes Eloquent. The Spring equivalent should accept a port
interface (e.g. `AdminRecordRepository<T>`) injected by the adopter, not hard-code
`JdbcClient` or `JpaRepository`. The admin layer should be persistence-agnostic; the
adopter wires the data.

**5. Alpine.js as primary interactivity layer.**
lievit already owns the interactivity contract (`l:click`, `l:model`, `l:submit`).
Admin-layer interactivity should ride lievit, not add a second client framework.
Limit Alpine to what lievit does not cover (floating-UI dropdowns, non-wire toggles).

### Design lessons (distilled)

- **The panel builder is a great UX for configuration but hides complexity.**
  Filament's `Panel` accumulates 35 traits. Keep the Spring equivalent under 10; factor
  heavy concerns (tenancy, multi-auth, global search) into opt-in modules.
- **The Schema unification (v4) was a correctness improvement under a breaking API.**
  In Java, design the form/table/infolist builders to share a common parent from v0.1.
  Don't ship three independent builder hierarchies that need a later unification.
- **Macros are a safety valve, not a design.**
  Filament leans on `Macroable` to let third parties add methods to any class. In Java,
  use the builder's `configure()` hook and `Plugin.register()` instead. Macros bypass type
  safety.
- **The upgrade story is a product feature.**
  Filament ships a Rector ruleset. Plan the equivalent from the start: a `./mvnw filament:upgrade`
  command (or Maven plugin) that mechanically applies breaking changes in minor/major bumps.
- **Don't force modal-CRUD as the only alternative to full-page-CRUD.**
  Filament's `ManageRecords` (`packages/panels/src/Resources/Pages/ManageRecords.php`)
  collapses list + create + edit into one page using modals. That is a useful third mode;
  offer it but don't couple the architecture to it.
- **Authorization belongs at the Resource/Page boundary, not scattered in the view.**
  Filament calls `authorizeAccess()` in `mount()` on every page. Mirror this: check
  authorization at component mount, before any rendering.

---

## File references (load-bearing citations)

| File | What was read |
|---|---|
| `packages/support/src/Components/Component.php:9-11` | base Component (Conditionable, EvaluatesClosures, Macroable, Tappable) |
| `packages/panels/src/PanelProvider.php:1-12` | Panel registration pattern |
| `packages/panels/src/Panel.php:1-55` | Panel trait assembly (~35 concerns) |
| `packages/panels/src/PanelRegistry.php` | singleton panel registry, default-panel resolution |
| `packages/panels/src/Panel/Concerns/HasComponents.php` | `discoverResources()`, resource directory scanning |
| `packages/panels/src/Panel/Concerns/HasRenderHooks.php` | render hook registration |
| `packages/panels/src/Panel/Concerns/HasTheme.php` | `viteTheme()`, `theme()`, `getDefaultTheme()` |
| `packages/panels/src/Panel/Concerns/HasIcons.php` | `icons([])`, per-panel icon override |
| `packages/panels/src/Panel/Concerns/HasPlugins.php` | `plugin(Plugin)`, `getPlugin(string)` |
| `packages/panels/src/Contracts/Plugin.php` | `Plugin` interface (getId, register, boot) |
| `packages/panels/src/Resources/Resource.php:1-120` | Resource abstract class, static method surface, model derivation |
| `packages/panels/src/Resources/Resource/Concerns/HasPages.php` | `getPages()`, `hasPage()` |
| `packages/panels/src/Resources/Resource/Concerns/HasRoutes.php` | route base name derivation, slug |
| `packages/panels/src/Resources/Resource/Concerns/HasNavigation.php` | `registerNavigationItems()`, navigation properties |
| `packages/panels/src/Resources/Pages/ListRecords.php:1-70` | ListRecords Livewire component, `#[Url]` table state |
| `packages/panels/src/Resources/Pages/CreateRecord.php:1-60` | CreateRecord Livewire component |
| `packages/panels/src/Resources/Pages/ManageRecords.php` | single-page CRUD pattern |
| `packages/panels/src/Pages/BasePage.php:1-80` | `render()` wiring, `getView()`, `getLayout()` |
| `packages/panels/src/Pages/Page.php:1-80` | navigation, cluster, header actions |
| `packages/panels/src/FilamentManager.php:1-80` | runtime panel resolution, navigation build |
| `packages/panels/src/FilamentServiceProvider.php:1-80` | IoC binding, scoped singleton |
| `packages/panels/src/View/PanelsRenderHook.php` | 40+ named render hook constants |
| `packages/panels/resources/css/index.css` | package CSS chaining, `@theme inline` tokens |
| `packages/panels/resources/css/theme.css` | Tailwind v4 `@import 'tailwindcss' source(none)` |
| `packages/schemas/src/Schema.php:1-80` | v4 unified Schema class, 20 concerns |
| `packages/schemas/src/Components/` | Form, Grid, Group, Section, Fieldset, Livewire, RenderHook |
| `packages/forms/src/Components/` | TextInput, Select, DatePicker, FileUpload, Repeater, Builder... |
| `packages/tables/src/Columns/Column.php` | TextColumn, BadgeColumn, ImageColumn, ToggleColumn... |
| `packages/actions/src/Action.php:1-50` | Action (button/icon-button/link/dropdown item), Halt/Cancel |
| `packages/support/src/Icons/Heroicon.php` | Heroicon PHP enum (backed string, all slugs) |
| `packages/support/src/Assets/Theme.php` | Theme asset type |
| `packages/upgrade/src/Rector/SimplePropertyChangesRector.php` | v3→v4 property breaks |
| `packages/upgrade/src/Rector/SimpleMethodChangesRector.php` | v3→v4 method signature breaks |
| `packages/upgrade/src/Rector/RenameSchemaParamToMatchTypeRector.php` | `$form`→`$schema` rename |
| `composer.json` | monorepo package namespaces, PSR-4 map |
| `package.json` | frontend deps: Tailwind v4 CLI, Alpine.js plugins, esbuild, Tiptap, Floating UI |

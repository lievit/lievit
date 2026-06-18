# kit-crud-admin example

A small CRUD admin built end-to-end on **lievit-kit**, plus a reactive lievit search island. It is
richer than the [golden-path starter](../golden-path-starter/): it exercises the full
Resource / Form / Table path, Bean Validation on save, a delete action, pagination, and a
live-search component over the wire.

## What it shows

- A `ProductResource` ([`product/ProductResource.java`](src/main/java/io/lievit/example/admin/product/ProductResource.java))
  declaring a **Table** (sortable + searchable columns, a status badge, a formatted price) and a
  **Form** (text + select fields, a binder, a Bean Validation validator).
- A persistence-agnostic **`RecordRepository<Product>`** backed by an in-memory list
  ([`InMemoryProductRepository`](src/main/java/io/lievit/example/admin/product/InMemoryProductRepository.java)) —
  no database required. Swapping it for JDBC/JPA would not touch the resource, the controllers, or
  the templates.
- A controller ([`web/ProductAdminController.java`](src/main/java/io/lievit/example/admin/web/ProductAdminController.java))
  that turns the resource into the kit's **`AdminListView` / `AdminFormView` view-models** and renders
  them with Thymeleaf, following the Filament route shape via `AdminRoutes` (`/admin/products`,
  `/admin/products/create`, `/admin/products/{id}/edit`). lievit-kit ships no HTTP routes by design;
  this controller is the adopter's wiring.
- Bean Validation: an invalid create/edit fails `Form#save`, and the form re-renders with per-field
  errors.
- A reactive **`ProductSearchComponent`** ([`product/ProductSearchComponent.java`](src/main/java/io/lievit/example/admin/product/ProductSearchComponent.java)) —
  a lievit component with `l:model.live` search that re-queries the repository over the wire on every
  keystroke, mounted on the list page. This is the interactive island next to the server-rendered
  CRUD pages.
- Spring Security form login covering the pages and the wire endpoint (wire-protocol §7).

## Run it

```bash
# from the repo root
./mvnw -pl examples/kit-crud-admin -am spring-boot:run
```

Then open <http://localhost:8080/admin/products> and sign in as `admin` / `admin`.

- The list paginates 5 products per page.
- The live-search box at the top re-queries over the wire as you type.
- "New product" and "Edit" open the form; submitting an invalid value (blank name, a non-numeric
  price) re-renders the form with inline errors.
- "Delete" removes a row (with a confirm prompt).

## Test it

```bash
./mvnw -pl examples/kit-crud-admin -am verify
```

- [`ProductResourceTest`](src/test/java/io/lievit/example/admin/ProductResourceTest.java) — pure
  (no-Spring) tests of the kit wiring: the view-models, and the form's save + validation.
- [`AdminAppSmokeTest`](src/test/java/io/lievit/example/admin/AdminAppSmokeTest.java) — boots the app,
  mounts the search component over the real wire pipeline.

## Where to read more

- [The lievit-kit admin guide](../../docs/guide/kit-admin.md)
- [Components and the wire protocol](../../docs/guide/components-and-wire.md)
- [Forms and validation](../../docs/guide/forms-and-validation.md)
- [Directives reference](../../docs/guide/directives.md)

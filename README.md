# lievit

> **HTML over the wire for Spring. Type-safe. Native. EU-grade.** lievit is the opinionated,
> named full-stack way to build interactive Spring apps, the Livewire / Hotwire / LiveView
> category for Java. Write a reactive component as a typed Java class, render it server-side,
> and lievit keeps the browser in sync over a stateless, HMAC-signed wire. No JSON API, no
> client state store, no parallel frontend codebase. Apache 2.0, no SaaS.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/java-25-orange.svg)](https://openjdk.org/projects/jdk/25/)
[![Spring Boot](https://img.shields.io/badge/spring--boot-4.0-green.svg)](https://spring.io/projects/spring-boot)

> **Status: pre-public foundation.** The conventions, the docs, and the design decisions are
> being laid down. The build (Maven, modules, runtime code) is **not wired yet**, by intent.
> The code samples below are the **API-first contract** the implementation will be built to,
> spec-first, not yet runnable. Project home and canonical reference:
> [iambilotta.com](https://iambilotta.com).

```
For:     Spring developers building interactive, business / internal / CRUD-heavy apps
         who want rich interactivity without an SPA, without JSON contracts, and
         without a parallel frontend codebase. Especially the htmx-curious Spring dev
         hand-rolling htmx + Thymeleaf, and the ex-Laravel / Rails migrant who misses
         the Livewire / Hotwire developer experience on the JVM.
Does:    HTML over the wire, Spring-native: a reactive component is a typed Java class;
         lievit syncs the DOM over a stateless, HMAC-signed wire call.
Stack:   Java 25 + Spring Boot 4 + JTE (primary) + htmx 2 + Lit 3. GraalVM-native day one.
Cost:    Apache 2.0, no SaaS, no paywall, no data egress.
Not:     Not a framework alternative to Spring (it lives INSIDE Spring), not a component
         library, not a kit. You bring Spring; lievit makes it interactive.
```

[**The category**](#the-category) ·
[**The three strata**](#the-three-strata) ·
[**The public API**](#the-public-api-nine-annotations) ·
[**Hello component**](#hello-component-api-first-sketch) ·
[**Single-file vs multi-file**](#single-file--multi-file) ·
[**Wire protocol**](#wire-protocol-v01) ·
[**ADRs**](docs/adr/) ·
[**Docs plan**](docs/PLAN.md)

---

## The category

lievit is **not** a library, **not** a framework alternative to Spring, and **not** a kit.

- A library or kit is too small to be a way of building: it is a disposable artifact, nothing
  to identify with.
- A framework alternative (its own DI, routing, runtime) would be a poor copy of Quarkus or
  Micronaut and would violate the one principle that holds: lievit lives **inside** Spring.
- The thing that becomes a way of building is a **named full-stack layer on top of the existing
  framework**. Livewire is that for Laravel; Hotwire is that for Rails. lievit is that for Spring.

The Spring core is Broadcom's; lievit sits on top of Spring Boot and never replaces it. The
unique mechanism (term-as-IP): **HTML over the wire, type-safe by construction, on a stateless
signed wire**, see [iambilotta.com](https://iambilotta.com).

## The three strata

1. **The interactivity runtime (the core).** HTML over the wire, Spring-native, stateless,
   type-safe, GraalVM-native. This is the piece the IDE does not cover and that Spring lacks.
2. **The golden-path kit (the cohesion).** An opinionated reference app: Spring Security done
   well + a Modulith structure + lievit wired + sane defaults. The analogue of Laravel's
   Breeze / Jetstream. It is *content* (an excellent app), not tooling. Instantiated with
   `lievit new` (or a template repo): you want the golden path to be exact and deterministic.
3. **The `lievit` CLI (thin).** A thin kit installer (`lievit new`), a dev loop (`lievit dev`),
   GraalVM-native build / test ergonomics (`lievit native:build`, `lievit native:test`), and
   `lievit doctor`. The heavy `make:*` scaffold generator is deferred / AI-replaced: the IDE
   already owns scaffolding on the JVM.

The name **is** the command. `lievit new`, `lievit dev`: one identity for the runtime, the kit,
and the CLI.

## The five user-facing concepts

A developer only ever thinks about five things:

| Concept | What it is |
|---|---|
| **Component** | A server-side reactive unit: a typed Java class. |
| **Wire** | A field bound bidirectionally between the class and the template. |
| **Action** | A method on the component, callable from the template (`l:click`, `l:submit`). |
| **Mount** | The lifecycle hook that runs after construction, before the first render. |
| **Render** | The render step (template + checksum + signed snapshot). |

## The public API (nine annotations)

The public surface is nine annotations (ADR-0002's seven-annotation cap superseded by ADR-0015 for
`@LievitComputed` — see [`docs/adr/0015`](docs/adr/0015-computed-properties.md) — and by the
URL-binding feature for `@LievitUrl`):

| Annotation | Purpose |
|---|---|
| `@EnableLievit` | Turns on the starter autoconfiguration, on a `@Configuration` class. |
| `@LievitComponent` | Marks a Java class as a server-side component (implicitly a Spring `@Component`). |
| `@Wire` | Binds a field bidirectionally between class and template, compile-time type-checked. |
| `@LievitAction` | Marks a method callable from the template. |
| `@LievitMount` | Lifecycle hook: after construction, before render. |
| `@LievitRender` | Custom pre-render hook. |
| `@LievitProperty` | Optional: extended metadata on a `@Wire` field (serialize, locked, modelable two-way bind). |
| `@LievitComputed` | Marks a no-arg method as a per-request computed property (memoized once per wire call, not serialized into the snapshot). |
| `@LievitUrl` | Optional: reflects a `@Wire` field into the URL query string (mount-from-query + `url` effect on change). |

## Hello component (API-first sketch)

> Spec-first. This is the contract the implementation will be built to; it does not run yet.

A counter, multi-file mode (typed Java class + a JTE template):

```java
// src/main/java/com/example/CounterComponent.java
@LievitComponent
public class CounterComponent {

    @Wire
    int count;

    @LievitAction
    public void increment() {
        count++;
    }

    @LievitAction
    public void decrement() {
        count--;
    }
}
```

```html
<!-- src/main/jte/counter.jte -->
@param int count
<div>
    <button l:click="decrement">-</button>
    <span>${count}</span>
    <button l:click="increment">+</button>
</div>
```

```java
// turn the starter on, once, on any @Configuration
@SpringBootApplication
@EnableLievit
public class DemoApplication { }
```

That is the whole loop. A click on a button calls the action over the wire, the server
re-renders the component, and lievit patches only the changed DOM. No controller, no JSON, no
client-side state.

### Single-file mode (type-safe by construction)

The same component, single-file, using the typed HTML DSL (no separate template, the Java
compiler checks the markup):

```java
@LievitComponent
public class Counter {

    @Wire int count;

    @LievitAction public void increment() { count++; }
    @LievitAction public void decrement() { count--; }

    @LievitRender
    Html render() {
        return div(
            button(text("-")).attr("l:click", "decrement"),
            span(text(count)),
            button(text("+")).attr("l:click", "increment")
        );
    }
}
```

Single-file is not a trade on type-safety: it is "DSL instead of JTE", both are type-safe.
Reactive single-file type-safe components are the hard differentiator: impossible in Volt / PHP
(not compiled). See [`docs/adr/0003`](docs/adr/0003-single-file-multi-file-dual-mode.md).

The DSL lives in the `lievit-dsl` module (`import static io.lievit.dsl.H.*;`): a sealed
`Html` tree built by static factories (`div`, `span`, `button`, `text`, `el`), escape-by-construction
(a `@Wire` value carrying markup renders inert; the one escape hatch is the explicit `raw(...)`), and
wire-binding helpers (`.wireClick("increment")`, `.wireModel("name")`) that emit the `l:*` markers the
client binds. A `DslTemplateAdapter` renders the `@LievitRender Html` tree through the same wire
pipeline (mount, wire call, effects, morph) as a template component, behind the one `TemplateAdapter`
SPI, so the dispatcher and codec are untouched. See
[`docs/adr/0018`](docs/adr/0018-single-file-dsl.md).

## Single-file + multi-file

Both modes ship from v0.1, both are type-safe:

- **Single-file**: a `.java` class with the template inline via a typed HTML DSL. The Java
  compiler verifies the markup. One file, colocation.
- **Multi-file**: a `.java` class plus a separate **JTE** template, type-safe via annotation
  processing, friendlier for HTML-heavy / designer-authored markup.

JTE is the canonical primary template engine; Thymeleaf, Mustache, FreeMarker, and raw are
first-class adapters behind one engine-agnostic abstraction. See
[`docs/adr/0004`](docs/adr/0004-template-adapter-strategy.md).

## Wire protocol v0.1

The full normative spec is [`docs/adr/0001`](docs/adr/0001-wire-protocol-v0.1.md). In brief:

- **Endpoint**: `POST /lievit/{componentId}/call`, stateless.
- **Payload**: `{ _token, _snapshot (jwt-hs256), _updates, _calls }`.
- **Response**: `text/html` + header `Lievit-Snapshot`.
- **Snapshot**: `{cid, cls, wire, iat, exp}`, HMAC-SHA-256 signed (HS256, `kid` header for
  rotation). Carries **state, never code**; the class is an FQN resolved at unwrap time.
- **DOM patching**: a bespoke identity-preserving morph (no DIY diff, no innerHTML, no virtual DOM;
  ADR-0019 amends ADR-0001's Idiomorph choice to keep the client bundle dependency-free).
- **Client modifiers**: `l:model.live / .lazy / .blur / .debounce.500ms` (debounce 500 ms is
  the default, opt out with `.eager`), events `l:click / submit / keydown.enter`.
- **Errors** (fail-closed, empty body, only the `Lievit-Reason` header; ADR-0014): `410 Gone`
  (unknown FQN or non-`@LievitAction` call), `409` + `snapshot-expired`, `413` + `too-large`
  (> 64 kb) / `too-complex` (too many updates/calls or over-deep nesting; ADR-0013), `422` +
  `forbidden-deserialization` (non-JSON `@Wire` value; ADR-0013), `403` + `locked-property`,
  `429` + `too-many-failures`, `500` + `internal-error` (generic; detail server-side-logged),
  `504` (action timeout 5 s).
- **Limits**: payload 64 kb, snapshot 16 kb, idle TTL 1 h, action timeout 5 s, signing key
  >= 32 bytes base64url with a 24 h previous-key grace window.

## Real-time server-side validation

Add Jakarta Bean Validation constraints directly on `@Wire` fields. lievit validates the component
instance on every wire call, before running any action. If validation fails the action is skipped and
the per-field errors ride the `Lievit-Effects` header as the `errors` key. The template receives them
as the reserved `_errors` model parameter. Debounce is a client concern (`l:model.blur`,
`l:model.debounce.300ms`); the server validates idempotently on every call.

**Component** — annotate `@Wire` fields with any Jakarta constraint:

```java
@LievitComponent(template = "registration")
public class RegistrationComponent {

    @Wire @NotBlank(message = "Email is required") @Email(message = "Must be a valid email address")
    String email = "";

    @Wire @NotBlank(message = "Name is required") @Size(min = 2, message = "Name must be at least 2 characters")
    String name = "";

    @Wire boolean submitted = false;   // @Wire so it round-trips in the snapshot

    @LievitAction
    void submit() { this.submitted = true; }
}
```

**Template** — read `_errors` (always a `Map<String, List<String>>`, `null` when no errors):

```
@param Map<String, List<String>> _errors = null

<input l:model.blur="email" name="email" value="${email}">
@if(_errors != null && _errors.containsKey("email"))
    @for(String msg : _errors.get("email"))
        <span class="error" data-field="email">${msg}</span>
    @endfor
@endif
```

**Auto-wiring** — add `spring-boot-starter-validation` and lievit's autoconfiguration wires
`BeanValidationFieldValidator` automatically (Hibernate Validator on the classpath). No annotation,
no `@Bean` required. Swap in a custom `FieldValidator` bean to override (e.g. cross-field
validation, async checks):

```java
@Bean
FieldValidator myValidator(MyService svc) {
    return instance -> svc.validate(instance);
}
```

**Testing** — the harness exposes `assertHasError(field, fragment)`, `assertNoErrors()`,
`assertNoErrors(field)`:

```java
@Test
void invalid_email_blocks_submit() {
    test(RegistrationComponent.class)
        .mount()
        .model("email", "not-an-email")
        .model("name", "Alice")
        .call("submit")
        .assertHasError("email", "valid email")   // message contains "valid email"
        .assertNoErrors("name");
}

@Test
void valid_form_submits() {
    test(RegistrationComponent.class)
        .mount()
        .model("email", "alice@example.com")
        .model("name", "Alice")
        .call("submit")
        .assertNoErrors()
        .assertWireMatches(comp -> comp.submitted);
}
```

## Testing your components (`Lievit.test()`)

Full design in [`docs/adr/0010`](docs/adr/0010-dev-test-harness.md). lievit ships a developer-facing
component test harness, the answer to Livewire's `Livewire::test()` — and it pulls behaviour *out of
the browser*. Because lievit's wire is server-driven and typed, a fast in-process test drives the
**real** pipeline (codec → registry → dispatcher → template → the `POST /lievit/{id}/call` HTTP edge
over `MockMvc`) and reads typed state back. No browser, no JSON-map boilerplate, no snapshot juggling.

```java
import static io.lievit.test.Lievit.test;

@LievitTest                                  // one meta-annotation: slice + dev key + MockMvc
class CounterComponentTest {

    @Test
    void increments_over_the_wire() {
        test(CounterComponent.class)
            .mount()
            .assertWire("count", 0)          // typed state read-back, not a string grep
            .assertSee(">0<")                // the real re-rendered HTML
            .call("increment")               // over the REAL signed snapshot
            .assertWire("count", 1)
            .assertSee(">1<")
            .assertSnapshotRotated();        // a fresh Lievit-Snapshot came back
    }

    @Test
    void a_client_cannot_write_a_locked_field() {
        test(CounterComponent.class)
            .mount()
            .tamperUpdate("label", "x")      // a HOSTILE _updates entry, attacker's seat
            .call("increment")
            .assertRejected(LockedProperty.class);   // 403 — headless, what Livewire forces to a browser
    }
}
```

Assertion surface: `assertWire(path, value)` (typed, dotted + `.size` navigation),
`assertWireMatches(predicate)` (typed predicate over the real instance), `assertSee` / `assertDontSee`
/ `assertSeeHtml` / `assertSeeInOrder`, `assertSnapshotRotated` / `assertSnapshotValid`,
`assertRejected(<reason>.class)` for the whole error-code state machine — including `LockedProperty`
(403, attacker's seat) and `TooManyFailures` (429), the two Livewire's own component tester cannot
reach — and `assertHasError(field, fragment)` / `assertNoErrors()` / `assertNoErrors(field)` for
real-time validation (the `errors` effect). Hostile-seat affordances `tamperUpdate(field, value)` and
`forgeSnapshot()` drive the locked and rate-limit defenses headless. Failure messages name the call
sequence that produced the state (`expected @Wire count == 1 but was 0 after calls [increment]`).
`@LievitTest` is test-scope and does **not** count against the seven-annotation public cap.

## Custom elements

lievit ships brand-visible custom elements: `<lievit-loading>`, `<lievit-error>`,
`<lievit-stream>` (the `<lievit-*>` prefix, Lit-based).

## Theming

Zero CSS by default, never imposed. An opt-in theme package (`lievit-theme-italian-grade`) is
available for those who want a polished default look.

## Positioning

lievit is the stateless inverse of Vaadin Flow: scale-out and scale-to-zero instead of a
stateful server, fine HTML control, Apache-licensed with no Pro paywall, a 60-80 kb client
bundle, type-safe, GraalVM-native. The honest boundary (inherited from htmx): 95% of business /
internal / CRUD-interactive apps, not heavy client-state apps. Full competitor analysis and the
unique mechanism live at [iambilotta.com](https://iambilotta.com).

## License

Apache License 2.0. See [LICENSE](LICENSE). Copyright 2026 Francesco Bilotta.

## Project home

Canonical reference, the manifesto, and the screencasts: [iambilotta.com](https://iambilotta.com).

# lievit

> **HTML over the wire for Spring. Type-safe. Native. EU-grade.** lievit is the opinionated,
> named full-stack way to build interactive Spring apps, the Livewire / Hotwire / LiveView
> category for Java. Write a reactive component as a typed Java class, render it server-side,
> and lievit keeps the browser in sync over a stateless, HMAC-signed wire. No JSON API, no
> client state store, no parallel frontend codebase. Apache 2.0, no SaaS.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/java-25-orange.svg)](https://openjdk.org/projects/jdk/25/)
[![Spring Boot](https://img.shields.io/badge/spring--boot-4.0-green.svg)](https://spring.io/projects/spring-boot)

> **Status: pre-1.0 (`0.1.0-SNAPSHOT`), build live.** The Maven reactor builds green: 11 modules
> (the wire runtime, the single-file DSL, five template adapters, the Spring Boot starter, the
> admin kit, the CLI), the `Lievit.test()` harness, and a runnable golden-path example. The API
> is still pre-1.0 and may move before a tagged `0.1.0`. Not yet on Maven Central; consume it
> today via JitPack (see [Install](#install)). Project home and canonical reference:
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

[**Install**](#install) ·
[**The category**](#the-category) ·
[**The three strata**](#the-three-strata) ·
[**The public API**](#the-public-api-nine-annotations) ·
[**Hello component**](#hello-component-api-first-sketch) ·
[**Single-file vs multi-file**](#single-file--multi-file) ·
[**Wire protocol**](#wire-protocol-v01) ·
[**ADRs**](docs/adr/) ·
[**Docs plan**](docs/PLAN.md)

---

## Install

lievit is not on Maven Central yet. Until the first signed `0.1.0` lands there, consume it via
[JitPack](https://jitpack.io), pinned to a commit SHA (or a tag once one exists). JitPack builds
the Java 25 reactor on demand (see [`jitpack.yml`](jitpack.yml)) and publishes every module under
the coordinate `com.github.lievit.lievit:<module>`.

The one dependency most apps need is the Spring Boot starter (`lievit-spring-boot-starter`); add
`lievit-kit` for the admin layer and `lievit-dsl` for the single-file typed-HTML mode.

**Maven** — add the JitPack repository and the starter:

```xml
<repositories>
    <repository>
        <id>jitpack.io</id>
        <url>https://jitpack.io</url>
    </repository>
</repositories>

<dependency>
    <groupId>com.github.lievit.lievit</groupId>
    <artifactId>lievit-spring-boot-starter</artifactId>
    <version>main-SNAPSHOT</version> <!-- or a commit SHA / tag, e.g. 06b7e36 -->
</dependency>
```

**Gradle** (Kotlin DSL):

```kotlin
repositories {
    maven { url = uri("https://jitpack.io") }
}

dependencies {
    implementation("com.github.lievit.lievit:lievit-spring-boot-starter:main-SNAPSHOT")
}
```

Pin a commit SHA rather than `main-SNAPSHOT` for a reproducible build (the SHA is immutable on
JitPack). The version follows JitPack's rules: a tag, a commit, or `<branch>-SNAPSHOT`. The first
build of any new ref takes a minute while JitPack compiles the reactor; subsequent resolves are
cached.

### Maven Central (planned)

On the first tagged release the modules will also publish to
[Maven Central](https://central.sonatype.com) under the groupId **`io.github.lievit`** (the free,
GitHub-org-verified namespace), so you can drop the JitPack repository and depend on the plain
coordinate:

```xml
<!-- planned: available from the first tagged 0.1.0 on Maven Central -->
<dependency>
    <groupId>io.github.lievit</groupId>
    <artifactId>lievit-spring-boot-starter</artifactId>
    <version>0.1.0</version>
</dependency>
```

```kotlin
// planned: available from the first tagged 0.1.0 on Maven Central
implementation("io.github.lievit:lievit-spring-boot-starter:0.1.0")
```

The Java packages stay `io.lievit.*` (the groupId is the publish namespace, not the package). The
release machinery (signed source + javadoc jars via the `release` Maven profile) is wired but not
yet exercised; until the first release is observed live on Central, JitPack above is the path.

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

## The public API (annotations)

The core surface began as nine annotations (ADR-0002's seven-annotation cap superseded by ADR-0015
for `@LievitComputed` — see [`docs/adr/0015`](docs/adr/0015-computed-properties.md) — and by the
URL-binding feature for `@LievitUrl`). The Livewire runtime-parity epic (Epic #34, ADR-0030 /
ADR-0031) adds the parity surface below the line:

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
| `@LievitOn` | Event listener: a method (or class-level `$refresh`) that fires when a dispatched event arrives; dynamic `{placeholder}` names, repeatable (ADR-0030). |
| `@LievitRenderless` | Marks an action as renderless: no HTML patch after it runs (ADR-0031). |
| `@LievitSession` | Persists a `@Wire` field into the HTTP session (the deliberate, opt-in exception to statelessness; prefer `@LievitUrl` for shareable state) (ADR-0031). |
| `@LievitLayout` / `@LievitTitle` | Full-page component: the layout it renders inside and its `<title>` when used as a route target (ADR-0031). |

### Runtime parity: events, lifecycle, magic actions, redirects (Epic #34)

Beyond `mount`/`render`, a component can declare the full **lifecycle hooks** by convention —
`boot`/`booted`, `hydrate`/`dehydrate`, `updating`/`updated` (and per-property `updating{Prop}` /
`updated{Prop}`), `rendering`/`rendered` — dispatched through the lifecycle bus at the matching
phase (`updating` sees the old value, `updated` the new). None is reachable as a frontend action.

**Magic actions** work in a template expression with no method on the component:
`l:click="$set('open', true)"`, `$toggle('open')`, `$refresh`, `$get('x')`, `$parent`. The server
resolves them and applies the same settable allowlist a `wire:model` update obeys (a `$set` on a
locked or unknown field is silently dropped).

**Events.** An action dispatches with `LievitEffects.current().dispatch("saved", detail)` (or
`dispatchSelf` / `dispatchTo(component, ...)`); a listener receives it via `@LievitOn("saved")`.

**Redirects.** `LievitEffects.current().redirect("/done")` queues the redirect and skips the
re-render by default (no wasted HTML the client is about to discard).

**Client contract for cross-component events (the server↔client interface, ADR-0030).** The
`Lievit-Effects` response header's `dispatch` array carries `{name, detail, to?, self?}`. The
client runtime re-emits each as a DOM `CustomEvent(name, {detail})` on `window`, then — respecting
`to` (deliver only to components of that name) and `self` (only the dispatching component) — issues
a wire call to each listening component with the request field `_events: [{name, detail}]`. The
server runs that component's matching `@LievitOn` listeners (binding the detail to the handler's
parameters by name) and re-renders it. `$dispatch(name, detail)` in an `l:*` expression is a global
dispatch. The `_events` field and the `to`/`self` keys are additive: absent, the response and
request are exactly the pre-#34 shape.

## Hello component (API-first sketch)

> This is the runnable API as it ships in `0.1.0-SNAPSHOT`. The signature may still move before
> the tagged `0.1.0`, but the build is live: see the golden-path example under `examples/`.

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

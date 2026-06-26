# lievit

> ## ⚠️ Status: parked — maintenance mode (a POC, not an active project)
>
> lievit was an attempt to build a **"Livewire for Java"**: server-rendered, type-safe,
> HTML-over-the-wire interactivity for Spring. The idea still has potential and the core wire
> protocol works, but **it is not something I can dedicate time to right now**, and in honesty it
> was always more of a **proof-of-concept** than a finished product — the presets and the
> component library still have real rough edges, and shipping a component library that isn't
> battle-tested is itself the problem (see below). So lievit is **paused**: it stays on Maven
> Central as-is, issues/PRs are welcome but unscheduled, and no new releases are planned.
>
> **Why (the honest engineering reason).** There are two different axes of robustness, and lievit
> only buys one. *Compile-time type-safety* (lievit's bet) catches errors of **form** at `mvn
> compile`. *Battle-tested components* (React + Ant Design, MUI, …) catch errors of
> **implementation** — the date-picker, the autocomplete, the accessibility, the thousand UX edge
> cases that millions of users have already found and fixed over years. lievit-ui's components are
> new; they re-pay that implementation-robustness from zero. Under the "choose boring technology /
> innovation-token" lens, a brand-new component library is the non-boring choice that has to justify
> itself — and right now it can't. Picking the most-traveled road (a mature component library behind
> a typed API) is *Appropriate Complexity*, not accidental complexity.
>
> To be clear about what failed: the **law** wasn't wrong — robustness where it counts, battle-tested
> over reinvented, the boundary owned by the JVM. What didn't pay off was the *specific*
> HTML-over-the-wire bet: even at full AI leverage a brand-new component library stayed too rough, and
> structurally it can't buy the implementation axis. So the rich-UI binding moves to a mature component
> library behind a typed API. Security lives at the **backend** and the client is **never trusted** —
> it's a SPA, not server-rendered, and that's fine: the JVM owns validation, authz and the domain, the
> frontend just talks to one API surface, and server-side rendering's only remaining job is SEO. (The
> cost — a parallel frontend codebase and a generated API contract to keep in sync — is a liability to
> price, not a security loss.) lievit stays a valid binding for the compile-time-type-safe
> server-rendered quadrant; it just isn't the one I'm investing in now.

> **HTML over the wire for Spring. Type-safe. Native. EU-grade.** lievit is the opinionated,
> named full-stack way to build interactive Spring apps, the Livewire / Hotwire / LiveView
> category for Java. Write a reactive component as a typed Java class, render it server-side,
> and lievit keeps the browser in sync over a stateless, HMAC-signed wire. No JSON API, no
> client state store, no parallel frontend codebase. Apache 2.0, no SaaS.

[![Maven Central](https://img.shields.io/maven-central/v/dev.lievit/lievit-spring-boot-starter.svg?label=Maven%20Central)](https://central.sonatype.com/artifact/dev.lievit/lievit-spring-boot-starter)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/java-25-orange.svg)](https://openjdk.org/projects/jdk/25/)
[![Spring Boot](https://img.shields.io/badge/spring--boot-4.0-green.svg)](https://spring.io/projects/spring-boot)

> **Build status (parked — see the maintenance banner at the top).** The last published reactor
> builds green and stays on Maven Central as-is:
> the wire runtime, the single-file DSL, the v4 compiler, the JTE template adapter, the Spring Boot
> starter, the admin kit, the CLI, the UI component library + client runtime, and the
> `lievit-maven-plugin` that makes the libraries consumable by import, plus the `Lievit.test()`
> harness and runnable examples. (The thymeleaf/mustache/freemarker/raw adapters are parked on
> `wip/template-adapters` until implemented — no empty jars ship.) lievit is server-rendered to the
> core: the UI primitives are JTE partials + plain-TS progressive enhancers, **no Lit / no Web
> Components shipped**. Consume it via
> Maven Central under `dev.lievit` (see [Install](#install)). See the [feature matrix](#feature-matrix) for the shipped-vs-roadmap split, and the
> [guides](docs/guide/) for task-oriented docs. Project home and canonical reference:
> [iambilotta.com](https://iambilotta.com).

```
For:     Spring developers building interactive, business / internal / CRUD-heavy apps
         who want rich interactivity without an SPA, without JSON contracts, and
         without a parallel frontend codebase. Especially the htmx-curious Spring dev
         hand-rolling htmx + Thymeleaf, and the ex-Laravel / Rails migrant who misses
         the Livewire / Hotwire developer experience on the JVM.
Does:    HTML over the wire, Spring-native: a reactive component is a typed Java class;
         lievit syncs the DOM over a stateless, HMAC-signed wire call.
Stack:   Java 25 + Spring Boot 4 + JTE (primary) + htmx 2 + a dependency-free
         TypeScript client runtime bundle. GraalVM-native day one.
Cost:    Apache 2.0, no SaaS, no paywall, no data egress.
Not:     Not a framework alternative to Spring (it lives INSIDE Spring), not a component
         library, not a kit. You bring Spring; lievit makes it interactive.
```

[**Install**](#install) ·
[**Feature matrix**](#feature-matrix) ·
[**The category**](#the-category) ·
[**The three strata**](#the-three-strata) ·
[**The public API**](#the-public-api-annotations) ·
[**Hello component**](#hello-component-api-first-sketch) ·
[**Single-file vs multi-file**](#single-file--multi-file) ·
[**Wire protocol**](#wire-protocol-v01) ·
[**Guides**](docs/guide/) ·
[**ADRs**](docs/adr/) ·
[**Examples**](examples/)

---

## Install

lievit is on [Maven Central](https://central.sonatype.com) under the groupId **`dev.lievit`**.
The one dependency most apps need is the Spring Boot starter (`lievit-spring-boot-starter`); add
`lievit-kit` for the admin layer and `lievit-dsl` for the single-file typed-HTML mode.

**Maven:**

```xml
<dependency>
    <groupId>dev.lievit</groupId>
    <artifactId>lievit-spring-boot-starter</artifactId>
    <version>1.0.3</version>
</dependency>
```

**Gradle** (Kotlin DSL):

```kotlin
dependencies {
    implementation("dev.lievit:lievit-spring-boot-starter:1.0.3")
}
```

## Feature matrix

What is in the build today versus what the ADRs name as deliberately deferred. The deferred items are
**roadmap, not features**: the protocol and the ADRs leave room for them without a breaking change.

### Shipped (`1.0.0`, stable)

| Area | What ships | Guide / ADR |
|---|---|---|
| Wire runtime | Stateless HMAC-signed snapshot, mount/render/action/re-render loop, codec, registry, dispatcher, `POST /lievit/{id}/call` + batch `/lievit/update` | [guide](docs/guide/components-and-wire.md), [ADR-0001](docs/adr/0001-wire-protocol-v0.1.md) |
| Component API | `@LievitComponent` / `@Wire` / `@LievitAction` / `@LievitMount` / `@LievitRender` / `@LievitProperty` / `@LievitComputed` / `@LievitUrl` / `@LievitOn` / `@LievitRenderless` / `@LievitSession` / `@LievitLayout` / `@LievitTitle` | [guide](docs/guide/components-and-wire.md) |
| Directives | `l:click` / `l:submit` / `l:keydown` / `l:model[.live/.lazy/.blur/.debounce]`; v4: `l:bind` / `l:text` / `l:dirty` / `l:error(s)` / `l:ref` / `l:sort` / `l:loading` / `l:island`; opt-in: `l:show` / `l:confirm` / `l:ignore` / `l:current`. SPA navigation is **Turbo Drive** (ADR-0085), not a directive. | [guide](docs/guide/directives.md), [ADR-0024](docs/adr/0024-v4-client-convergence.md), [ADR-0085](docs/adr/0085-adopt-turbo-drive-for-navigation.md) |
| Events & effects | `@LievitOn`, `dispatch` / `dispatchSelf` / `dispatchTo`, `$dispatch`, the `Lievit-Effects` channel (redirect / dispatch / returns / url / errors / islands / js / release) | [guide](docs/guide/events.md), [ADR-0030](docs/adr/0030-runtime-parity-events-lifecycle-magic-redirects.md) |
| Lifecycle & computed | `@LievitComputed`; convention hooks `boot`/`booted`/`hydrate`/`dehydrate`/`updating(Prop)`/`updated(Prop)`/`rendering`/`rendered`; the lifecycle bus | [guide](docs/guide/computed-and-lifecycle.md), [ADR-0015](docs/adr/0015-computed-properties.md), [ADR-0022](docs/adr/0022-request-lifecycle-bus.md) |
| Magic actions | `$set` / `$toggle` / `$refresh` / `$get` / `$parent` (settable-allowlist enforced) | [guide](docs/guide/directives.md), [ADR-0030](docs/adr/0030-runtime-parity-events-lifecycle-magic-redirects.md) |
| Forms & validation | Jakarta Bean Validation on `@Wire`, the `FieldValidator` SPI, the `_errors` model param, form objects (`LievitFormObject`) | [guide](docs/guide/forms-and-validation.md), [ADR-0017](docs/adr/0017-form-objects.md) |
| Nested components | Keyed children, reactive props, modelable two-way bind, deterministic keys | [guide](docs/guide/nested-components.md), [ADR-0016](docs/adr/0016-nested-components.md), [ADR-0023](docs/adr/0023-v4-compiler-and-deterministic-keys.md) |
| Islands | `l:island` + comment-marker fragments, replace/append/prepend morph | [guide](docs/guide/islands.md), [ADR-0024](docs/adr/0024-v4-client-convergence.md) |
| Single-file DSL | Type-safe `Html` builder (`dev.lievit.dsl.H`), escape-by-construction | [guide](docs/guide/single-file-dsl.md), [ADR-0018](docs/adr/0018-single-file-dsl.md) |
| Template adapters | JTE (primary) + Thymeleaf + Mustache + FreeMarker + raw | [ADR-0004](docs/adr/0004-template-adapter-strategy.md) |
| Typed state | Synthesizer registry + `Wireable` SPI, exact round-trip for records/enums/temporals/`BigDecimal`/`UUID`/`Set`/`Map`; class-instantiation guard | [ADR-0020](docs/adr/0020-typed-state-synthesizers.md), [ADR-0021](docs/adr/0021-class-instantiation-guard.md) |
| Security | HMAC + `kid` rotation, locked fields, settable/callable allowlist, payload caps, fail-closed errors, checksum-failure rate limit | [wire protocol](docs/wire-protocol.md), [ADR-0013](docs/adr/0013-payload-hardening.md), [ADR-0014](docs/adr/0014-fail-closed-error-rendering.md) |
| Admin (lievit-kit) | Resource / Form (text, textarea, select, toggle, date, belongs-to) / Table (columns, filters, grouping, summaries, soft-delete, reordering) / Actions (create, edit, delete, bulk, form) / Infolists / Panels / dashboard widgets / DB notifications; async jobs (sync default + executor opt-in), CSV import / export, multi-tenancy, clusters, settings | [guide](docs/guide/kit-admin.md) |
| Real-time | SSE broadcast channel (opt-in `lievit.broadcast.enabled`, per-`Principal`), live-push notifications, echo-listener bridge into the dispatch routing | [ADR-0040](docs/adr/0040-realtime-broadcast-channel-sse.md) |
| UI (lievit-ui) | 68 copy-in server-rendered JTE component primitives + design tokens, driven by a dependency-free TypeScript client runtime (no Lit, no framework) | [guide](docs/guide/lievit-ui.md), [ADR-0009](docs/adr/0009-lievit-ui-copy-in-registry.md), [ADR-0019](docs/adr/0019-client-runtime-bundle.md) |
| Testing | `Lievit.test()` headless harness (typed state read-back, hostile-seat affordances) | [ADR-0010](docs/adr/0010-dev-test-harness.md) |

### Roadmap (named in the ADRs, NOT in the build)

| Deferred | Where it is reserved |
|---|---|
| Server-side snapshot store (large-state components) | [wire protocol §6](docs/wire-protocol.md) |
| WebSocket transport + the `stream` effect (SSE broadcast shipped, see matrix) | [ADR-0001](docs/adr/0001-wire-protocol-v0.1.md), [ADR-0012](docs/adr/0012-effects-channel.md) |
| `download` effect (base64 file ride-along) | [ADR-0012](docs/adr/0012-effects-channel.md) |
| UUID v7 (time-ordered) component IDs | [wire protocol §2](docs/wire-protocol.md) |
| Kit relation fields beyond `BelongsToField` (`HasMany` / `BelongsToMany`) | lievit-kit |
| Cross-instance broadcast fan-out (message broker behind the SSE channel) | [ADR-0040](docs/adr/0040-realtime-broadcast-channel-sse.md) |

### Maven Central

Modules are published to [Maven Central](https://central.sonatype.com) under the groupId
**`dev.lievit`** (GitHub-org-verified namespace). The Java packages are `dev.lievit.*`
(the groupId is the publish namespace, not the Java package root).
Signed source + javadoc jars are produced via the `release` Maven profile.

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

The DSL lives in the `lievit-dsl` module (`import static dev.lievit.dsl.H.*;`): a sealed
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

## Real-time broadcast (live server→client push)

The wire loop is request/response. For the cases that need the server to push *to* a client
out-of-band of a request — a toast the moment someone assigns you a task, a notification bell that
refreshes live instead of on its 30 s poll — lievit ships an **opt-in realtime channel over
Server-Sent Events** (ADR-0040). SSE, not WebSocket: it keeps the stateless, scale-to-zero posture
(no sticky sessions, no server-held state), needs no extra dependency, and rides the page's existing
same-origin CSP. The channel carries server-pushed *events*, never component state, so the snapshot
stays the only state carrier.

It is **off by default**. Turn it on with one property; an app that does not push never opens a
connection:

```properties
lievit.broadcast.enabled=true
# lievit.broadcast.timeout=5m   # SSE idle timeout; the browser EventSource reconnects after it
```

The server mounts `GET /lievit/broadcast`, an SSE stream **keyed to the request `Principal`**: a
client can only ever subscribe to its own user's channel (anonymous → `401`). Push from anywhere
(an action, a scheduled job) through the `BroadcastChannel` bean:

```java
// kit: a live toast + a bell refresh to one recipient, plus the durable persisted copy
broadcastNotification.sendAndBroadcast(store, "agent-7", AdminNotification.success("New lead"));
```

A pushed event is the same `{name, detail?, to?}` envelope as a `dispatch` effect, so the client
routes it **exactly as a dispatched one**: re-emit on `window`, fire `runtime.on` listeners, and
deliver to matching `@LievitOn` components (`to` targets a component, e.g. the bell; absent is a
global fan-out — the Echo-listener bridge). Wire the client once:

```ts
import { startLievit, installBroadcast } from "@lievit/lievit-ui";

const lievit = startLievit({ csrfToken, csrfHeader });
installBroadcast(lievit);   // opens the SSE channel; closes it on navigation (Turbo Drive, ADR-0085)
```

Live push is best-effort (a recipient with no open client receives nothing live); the durable
persisted notification is the fallback the bell shows on next load, which is why `sendAndBroadcast`
persists too.

## Testing your components (`Lievit.test()`)

Full design in [`docs/adr/0010`](docs/adr/0010-dev-test-harness.md). lievit ships a developer-facing
component test harness, the answer to Livewire's `Livewire::test()` — and it pulls behaviour *out of
the browser*. Because lievit's wire is server-driven and typed, a fast in-process test drives the
**real** pipeline (codec → registry → dispatcher → template → the `POST /lievit/{id}/call` HTTP edge
over `MockMvc`) and reads typed state back. No browser, no JSON-map boilerplate, no snapshot juggling.

```java
import static dev.lievit.test.Lievit.test;

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

lievit reserves a brand-visible `<lievit-*>` custom-element namespace (`<lievit-loading>`,
`<lievit-error>`, `<lievit-stream>`; ADR-0005). These are plain native custom elements with no
framework behind them: the client is the dependency-free TypeScript runtime, not Lit. Today the
loading / error UX ships as runtime attribute directives (`l:loading`, `data-lievit-error-for`);
`<lievit-stream>` is reserved for the `stream` effect, which is on the roadmap (see the roadmap
table; SSE broadcast is the shipped real-time path).

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

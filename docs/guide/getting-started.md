# Getting started

Build a working Counter in five minutes: install via JitPack, write a component, render it, click a
button, watch the server re-render only the changed DOM. No JSON API, no client state store.

## 1. Install (JitPack)

lievit is not on Maven Central yet. Until the first signed `0.1.0` lands there, consume it through
[JitPack](https://jitpack.io), which builds the Java 25 reactor on demand and publishes every module
under the coordinate `com.github.lievit.lievit:<module>`.

Most apps need exactly one dependency: the Spring Boot starter.

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
    <version>main-SNAPSHOT</version> <!-- or pin a commit SHA for a reproducible build -->
</dependency>
```

**Gradle (Kotlin DSL):**

```kotlin
repositories {
    maven { url = uri("https://jitpack.io") }
}

dependencies {
    implementation("com.github.lievit.lievit:lievit-spring-boot-starter:main-SNAPSHOT")
}
```

Pin a commit SHA rather than `main-SNAPSHOT` for a reproducible build (the SHA is immutable on
JitPack). The first build of any new ref takes a minute while JitPack compiles the reactor;
subsequent resolves are cached.

You also need a template engine. JTE is the canonical primary; the starter wires it automatically
when `gg.jte:jte` is on the classpath. Add it:

```xml
<dependency>
    <groupId>gg.jte</groupId>
    <artifactId>jte</artifactId>
</dependency>
```

## 2. Turn the starter on

`@EnableLievit` on any `@Configuration` (your `@SpringBootApplication` is one) activates the
autoconfiguration: the codec, the component registry, the wire dispatcher, the JTE adapter, and the
`POST /lievit/{id}/call` endpoint.

```java
@SpringBootApplication
@EnableLievit
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

## 3. Configure the signing key

The wire snapshot is HMAC-signed (HS256); the key is the security boundary of the whole protocol. It
must be at least 32 bytes. A weak or missing key is a startup failure, not a runtime surprise.

```properties
# application.properties
# Dev key (decoded as UTF-8 bytes). In production use a base64url-encoded secret.
lievit.signing-key=replace-this-with-a-32-byte-or-longer-dev-key-please
```

In production prefer the `LIEVIT_SIGNING_KEY` environment variable; see
[the wire protocol §3](../wire-protocol.md#3-signing-hmac-sha-256-and-kid-rotation) for key rotation.

## 4. Write the component

A component is a typed Java class. `@Wire` fields hold the state that crosses the wire;
`@LievitAction` methods are callable from the template.

```java
// src/main/java/com/example/CounterComponent.java
@LievitComponent(template = "counter")
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

Each component is a **prototype** bean: a fresh instance per wire call, so no state leaks between
calls. The signed snapshot is the only carrier of state. If your component has collaborators (a
`JdbcTemplate`, a service), declare it as a prototype-scoped `@Bean`:

```java
@Bean
@Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
CounterComponent counterComponent() {
    return new CounterComponent();
}
```

A component with a no-arg constructor needs no `@Bean` declaration; the registry instantiates it.

## 5. Write the template (JTE)

```html
<!-- src/main/jte/counter.jte -->
@import io.lievit.component.ComponentMetadata
@param int count
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <button type="button" l:click="decrement">-</button>
    <span>${count}</span>
    <button type="button" l:click="increment">+</button>
</div>
```

The root element carries `data-lievit-component` so the client runtime can find the component and
read its snapshot. The `_component` model parameter is supplied by lievit on every render.

## 6. Render it on a page

A component renders inside a host page served by an ordinary Spring MVC controller. The client
runtime bootstraps from the `data-lievit-*` attributes on the component root. (For full-page
component routing without a host controller, see [`@LievitLayout` / `@LievitTitle`](../adr/0033-full-page-routing-and-slots.md).)

## 7. The loop

A click on a button calls the action over the wire. The server reconstructs the component from the
signed snapshot, applies any pending field updates, runs the action, re-renders, signs a fresh
snapshot, and returns the HTML. The client morphs only the changed DOM in place. No controller per
action, no JSON, no client-side state.

## 8. Test it without a browser

lievit ships a developer-facing test harness, `Lievit.test()`, that drives the **real** pipeline
(codec → registry → dispatcher → template → the HTTP edge over `MockMvc`) and reads typed state back.

```java
import static io.lievit.test.Lievit.test;

@LievitTest                                  // slice + dev key + MockMvc, one meta-annotation
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
}
```

## Next

- The runnable [golden-path example](../../examples/golden-path-starter/) (register, login,
  dashboard, a notes component) and the [CRUD admin example](../../examples/kit-crud-admin/).
- [Components and the wire protocol](components-and-wire.md) for the full lifecycle.
- The single-file alternative in [the single-file DSL](single-file-dsl.md): the same Counter with
  the markup written in type-safe Java instead of JTE.

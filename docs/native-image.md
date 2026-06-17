# GraalVM native image (how-to + reachability metadata)

This is the operational companion to [ADR-0006](adr/0006-graalvm-native-day-one.md) (the *why* of
native day one). It documents *how* a lievit app builds to a native image, what reachability
metadata lievit supplies, how to verify it, and the known limitations.

Status: the `native` Maven profile and the AOT reachability metadata are wired (this is the
build-side foundation). lievit's own modules are libraries with no main class; a native *image* is
produced by an **adopter's Spring Boot application** that depends on the lievit starter.

## Building a lievit app to native

```bash
# in the adopter's Spring Boot app (depends on com.iambilotta:lievit-spring-boot-starter)
./mvnw -Pnative native:compile      # produces a native executable in target/
```

The `native` profile (declared in lievit's parent POM because lievit does **not** inherit
`spring-boot-starter-parent`) wires two things:

1. **Spring AOT** (`spring-boot:process-aot`) — runs lievit's AOT contributors at build time and
   writes the GraalVM hint JSON under `META-INF/native-image/.../{reflect,serialization}-config.json`.
2. **GraalVM Native Build Tools** (`org.graalvm.buildtools:native-maven-plugin`) — invokes
   `native-image` with those hints + the GraalVM reachability-metadata repository.

A JVM build is untouched: `./mvnw verify` never activates the profile, so the JVM path stays
first-class (ADR-0006).

## What lievit registers (and why it must)

lievit drives the component lifecycle by **reflecting on the adopter's component classes itself**:
`ComponentMetadata.of(type)` reads the `@Wire` *declared fields* and the `@LievitAction` /
`@LievitMount` / `@LievitRender` *declared methods*, calls `setAccessible(true)`, and invokes them
on a fresh prototype instance per wire call. Spring AOT infers hints for the framework's own
reflective access (bean wiring, controller binding) but cannot know lievit will reflect over an
arbitrary adopter class, so without explicit hints those fields read back as defaults and the
actions are not found at runtime in a native image.

Two AOT contributors, both shipped in the starter, supply the metadata automatically (the adopter
writes no hint):

| Contributor | Registers | Mechanism |
|---|---|---|
| `LievitComponentsAotProcessor` | one reflection hint per `@LievitComponent` bean (declared fields + methods + constructors) | `BeanFactoryInitializationAotProcessor` in `META-INF/spring/aot.factories` (sees the live bean factory at build time) |
| `LievitRuntimeHints` | the wire DTOs that cross Jackson: `WireCallRequest` (request-body deserialization) + `WireEffects`/`WireEffects.Event` (serialized into the `Lievit-Effects` header) | `RuntimeHintsRegistrar` via `@ImportRuntimeHints` on `LievitAutoConfiguration` |

The component hint registers exactly the surface `ComponentMetadata` touches and no more
(closed-world, ADR-0006).

## Verifying the hints

Two layers, the first cheap (every build), the second authoritative (CI):

1. **Hint-completeness unit tests** (`*NfrTest`, surefire, seconds, no native compile): they run the
   registrar and the AOT processor and assert with `RuntimeHintsPredicates` that the reflective
   surface (component declared fields/methods/constructors, the wire DTOs) is registered. If a
   future change reflects over an unhinted member, these go RED long before the native gate does.
   Run: `./mvnw -pl lievit-spring-boot-starter test -Dtest='com.iambilotta.lievit.spring.native_.*'`.
2. **The native CI gate** (`.github/workflows/ci.yml`, the `native` job): `./mvnw -Pnative
   native:compile` on a real app, the authoritative proof the image builds and serves a wire call.

### Manual end-to-end check (an adopter app)

```bash
./mvnw -Pnative native:compile
LIEVIT_SIGNING_KEY=$(openssl rand -base64 32) ./target/<app>     # starts in < 100 ms target
# mount a component page, click an l:* action, confirm the wire call re-renders.
```

## Known limitations

- **Closed-world (Spring AOT).** Beans cannot change at runtime; `@Profile` / `@ConditionalOnProperty`
  with runtime-varying values are constrained (a Spring Boot native invariant, not lievit-specific).
- **Components must be discoverable at build time.** The AOT processor registers the
  `@LievitComponent` beans present in the bean factory during AOT. A component registered by a
  mechanism invisible to AOT would need a hand-written hint; the canonical path (a `@LievitComponent`
  prototype bean) is covered automatically.
- **`@Wire` field types reachable for JSON.** Scalar / list / map `@Wire` values (the
  deserialization allowlist of ADR-0013) are covered by the component reflection hint. A `@Wire`
  field of a custom record/POJO type that Jackson must reflect over may need
  `@RegisterReflectionForBinding` on that type (rare; the allowlist keeps most state JSON-shaped).
- **Build cost.** The native matrix lengthens CI (accepted, ADR-0006). The JVM path is unaffected.

# JTE real-compiler smoke + typed-facade gate (jte-models)

This directory is a throwaway Maven project with two jobs over **every**
`registry/jte/**/*.jte` (all static partials + the 4 blocks), with the same
`gg.jte:jte-maven-plugin` **3.2.4** the gest target uses.

## 1. Real-compiler smoke (issue #462)

The vitest golden suite asserts on the JTE partials as **source text** only. It never runs the
JTE compiler, so it cannot catch a real JTE syntax error. That is exactly how the `@* *@` comment
bug (and an `@if` in attribute-name position, an expression in a tag name, and several
boolean-attribute type errors) slipped in unnoticed.

The `generate` goal emits the template Java and the `maven-compiler-plugin` javac-compiles it, so
it fails on:

- JTE syntax errors (bad directives, attribute-position `@if`, comment syntax, unclosed tags),
- expressions in HTML tag names,
- boolean-attribute type mismatches (a `String` where JTE wants a `boolean`),
- captured non-effectively-final loop variables,
- unresolved references (e.g. the icon partial's `@import static ...LievitIcons.body`).

## 2. Typed facade via jte-models (the type-safe component API)

The `gg.jte.models.generator.ModelExtension` (wired into the same plugin) generates a typed
**`gg.jte.generated.precompiled.Templates`** interface: one method per registry partial, each
parameter list derived from the partial's `@param` signature, returning a `JteModel` you render.
It also generates `StaticTemplates` (precompiled, production) and `DynamicTemplates` (hot-reload)
implementations.

This is lievit's type-safety edge made consumable: an adopter's IDE indexes `Templates` from the
jar, so `templates.button(..)` / `templates.badge(..)` / `templates.chip(..)` autocomplete and
**compile-check** -- the javadoc-equivalent for the components. `TypedFacadeTest`
(`src/test/java/dev/lievit/ui/jtemodels/TypedFacadeTest.java`) resolves real components through the
facade and renders them, so the typed API is **proven**, not just asserted on source text. If a
partial's `@param` contract drifts, that test stops compiling.

### `switch.jte` is excluded from the facade (only)

`switch.jte` would derive the facade method name `switch`, a Java reserved word the jte-models
generator does not escape (it emits uncompilable Java). Renaming the partial is a wire/API break
(an adopter codes `@template.switch(..)`), so the pom excludes only the toggle-switch **from the
facade** (`<excludePattern>.*JteswitchGenerated</excludePattern>`, a `.matches()` full match
against the template's fully-qualified class name). The template itself is still generated and
javac-compiled, so the smoke still covers it, and it still ships in the registry.

## How an adopter ships the facade in their own jar

The registry is **copy-in** (shadcn model): the adopter copies the partials into their own
`src/main/jte` and runs the **same plugin block** in their build. The facade is then generated
into their `target/generated-sources/jte`, compiled into their jar, and their IDE indexes the
typed methods. Copy this into the adopter `pom.xml` (it is exactly what this harness runs):

```xml
<dependency>
  <groupId>gg.jte</groupId>
  <artifactId>jte-models</artifactId>   <!-- runtime: JteModel, StaticTemplates -->
  <version>${jte.version}</version>
</dependency>
...
<plugin>
  <groupId>gg.jte</groupId>
  <artifactId>jte-maven-plugin</artifactId>
  <version>${jte.version}</version>
  <configuration>
    <sourceDirectory>${project.basedir}/src/main/jte</sourceDirectory>
    <contentType>Html</contentType>
    <extensions>
      <extension>
        <className>gg.jte.models.generator.ModelExtension</className>
        <settings>
          <!-- only if you copied switch.jte in: -->
          <excludePattern>.*JteswitchGenerated</excludePattern>
        </settings>
      </extension>
    </extensions>
  </configuration>
  <dependencies>
    <dependency>
      <groupId>gg.jte</groupId>
      <artifactId>jte-models</artifactId>
      <version>${jte.version}</version>
    </dependency>
  </dependencies>
  <executions>
    <execution>
      <phase>generate-sources</phase>
      <goals><goal>generate</goal></goals>
    </execution>
  </executions>
</plugin>
```

Then, in production code:

```java
Templates templates = new StaticTemplates();          // precompiled, no reflection
String html = templates.badge("success", "Attivo", null, null, "").render();
```

`registry/icons/` is added as a compile source root here so the single generated
`LievitIcons.java` (package `it.housetreespa.gest.ui`) resolves the icon partial's static import.
No copy is made: the generated map stays its own source of truth.

## Run

```bash
# from lievit-ui/
npm run test:jte-compile
# or directly:
./test/jte-compile/run.sh
# or raw maven (generate + compile partials + facade, then run TypedFacadeTest):
mvn -q -f test/jte-compile/pom.xml clean test
```

Non-zero exit = at least one template failed to compile, or the typed-facade usage broke. Java +
Maven come from sdkman (`run.sh` sources `sdkman-init.sh`). Keep `jte.version` in `pom.xml` in
lockstep with the gest `gg.jte` version.

## CI

Wire `npm run test:jte-compile` into the lievit-ui CI job (it needs a JDK 25 + Maven on the
runner). The build output (`target/`) is gitignored.

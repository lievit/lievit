# JTE real-compiler smoke (issue #462)

The vitest golden suite asserts on the JTE partials as **source text** only. It never
runs the JTE compiler, so it cannot catch a real JTE syntax error. That is exactly how the
`@* *@` comment bug (and an `@if` in attribute-name position, an expression in a tag name,
and several boolean-attribute type errors) slipped in unnoticed.

This directory is a throwaway Maven project that precompiles **every**
`registry/jte/**/*.jte` (all static partials + the 4 blocks) with the same
`gg.jte:jte-maven-plugin` **3.2.4** that `apps/gest` uses. The `precompile` goal generates
the template Java **and** javac-compiles it, so it fails on:

- JTE syntax errors (bad directives, attribute-position `@if`, comment syntax, unclosed tags),
- expressions in HTML tag names,
- boolean-attribute type mismatches (a `String` where JTE wants a `boolean`),
- captured non-effectively-final loop variables,
- unresolved references (e.g. the icon partial's `@import static ...LievitIcons.body`).

`registry/icons/` is added as a compile source root so the single generated
`LievitIcons.java` (package `it.housetreespa.gest.ui`) resolves the icon partial's static
import. No copy is made: the generated map stays its own source of truth.

## Run

```bash
# from lievit-ui/
npm run test:jte-compile
# or directly:
./test/jte-compile/run.sh
# or raw maven:
mvn -q -f test/jte-compile/pom.xml clean process-classes
```

Non-zero exit = at least one template failed to compile. Java + Maven come from sdkman
(`run.sh` sources `sdkman-init.sh`). Keep `jte.version` in `pom.xml` in lockstep with
gest's `gg.jte` version.

## CI

Wire `npm run test:jte-compile` into the lievit-ui CI job (it needs a JDK 25 + Maven on the
runner). The build output (`target/`) is gitignored.

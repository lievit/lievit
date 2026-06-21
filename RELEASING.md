# Releasing lievit

How versions are numbered, where the changelog lives, and how breaking changes ship.
Read this before cutting a tag or landing a change that an adopter would feel.

## Versioning: `0.MINOR = breaking` while pre-1.0

The single source of version truth is the Maven `${revision}` property in the root `pom.xml`
(flattened by `flatten-maven-plugin`); a bump is a one-line edit.

Until lievit reaches `1.0.0` it follows the **pre-1.0 SemVer convention**, the same one Cargo and
much of the ecosystem use:

- **`0.MINOR.x` is the breaking unit.** Any backward-incompatible change to a public surface bumps
  the **minor** (`0.1.x -> 0.2.0`). Pre-1.0 there is no separate major lever, so the minor carries
  the "expect breakage" signal.
- **`0.x.PATCH` is additive or a fix.** New components, new opt-in SPI, bug fixes, and any
  byte-for-byte backward-compatible change bump the **patch** (`0.1.0 -> 0.1.1`).
- After `1.0.0`, normal SemVer takes over (major = breaking), as the README already states.

What counts as a public surface (a break here forces a `0.MINOR`):

- the **wire protocol** and snapshot format (the `@Wire` round trip, the `Lievit-Effects` keys);
- the **Java API** an adopter codes against (the seven annotations, the SPIs, `lievit-kit` builders,
  `Lievit.test()`);
- the **JTE partial / wire-template contract** an adopter renders against (a partial's `@param`
  list, a template's required model keys, a removed or renamed partial). The typed jte-models
  facade makes these breaks compile-visible: a changed `@param` changes the generated
  `Templates` method signature.

## One changelog, updated per release

There is exactly **one** `CHANGELOG.md` at the repo root, covering all modules
([Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format). Do not add per-module
changelogs.

- Every change lands an entry under **`## [Unreleased]`** in the right subsection
  (`Added` / `Changed` / `Fixed` / `Removed`), in the same PR as the change. A PR that moves a
  public surface without a changelog line is incomplete.
- Cutting a release = rename `[Unreleased]` to `## [x.y.z] - YYYY-MM-DD`, open a fresh empty
  `[Unreleased]` above it, bump `${revision}`, tag.
- A **breaking** change (a `0.MINOR` bump) gets a `### Migration` note in its release section:
  what moved, the before/after, and the recipe (below) if there is one.

## Breaking changes ship with a migration path

- **Wire / Java API breaks ship with an OpenRewrite recipe.** When a rename or signature change to
  the Java/wire surface is unavoidable, author an [OpenRewrite](https://docs.openrewrite.org/)
  recipe that performs the migration mechanically, ship it in the same `0.MINOR`, and reference it
  from the changelog `### Migration` note. The adopter runs `mvn rewrite:run` instead of
  hand-editing. (No recipes exist yet; the first Java/wire break introduces the recipe module.)
- **Template / `.jte` breaks are batched into a `0.MINOR`** rather than dribbled out. A partial's
  `@param` rename, a removed partial, or a changed required model key waits for the next minor and
  lands with a written **migration note** in the changelog (OpenRewrite does not rewrite `.jte`
  source, so the note is the migration). Because the registry is copy-in (shadcn model), the
  adopter re-runs `lievit add <component>` or diffs the note against their copy.

## Distribution

Pre-first-release, consume via JitPack (`com.github.lievit.lievit:<module>`, a tag / commit /
`<branch>-SNAPSHOT`); see the README. On the first tagged release the modules also publish to Maven
Central via the `release` profile (signed source + javadoc jars). The jte-models typed facade is
generated in the adopter's own build from the copied-in partials (see
`lievit-ui/test/jte-compile/README.md`), so it tracks the adopter's lievit version automatically.

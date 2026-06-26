# CLAUDE.md — `lievit` (workspace contract)

Sub-asset of the `iambilotta` umbrella. Strategy/voice live in the umbrella + `~/knowledge/`;
this file is the technical working contract for the lievit repo.

lievit is **"Livewire for Spring"**: a JTE component library + typed wire protocol + strict CSP,
groupId `dev.lievit`, published to Maven Central.

## Release / publish

- Publish with **`make publish`** (= `./mvnw -T1 clean deploy -Prelease -Dmaven.build.cache.enabled=false`).
  NEVER a bare `./mvnw deploy`: the `-T1C` parallel default in `.mvn/maven.config` DEADLOCKS the
  central-publishing + maven-gpg plugins. `make publish` forces serial `-T1` + build-cache off.
- After a green publish, tag the released commit: `git tag vX.Y.Z && git push --tags` (push is
  human-held; ask Francesco).
- The `release` profile (gpg signing + central-publishing `autoPublish`) and the Central
  token + gpg passphrase live in `~/.m2/settings.xml`, never committed.
- Version source of truth: the `${revision}` property in the root `pom.xml`. Versioning rules +
  changelog discipline: `RELEASING.md`.

## Commands

- Prefer CLEAN commands. Do NOT wrap a long command in `>> LOG; echo EXIT=$?` or `| grep`:
  that masks the REAL exit code. It bit us once — a deploy reported exit 0 from the trailing
  `echo` while Maven had actually exited 1.
- Trust the run-in-background mechanism: it captures output to a file and reports the REAL
  exit code. Read those, do not paper over them with pipes.

## Test

- Full reactor: **`make verify`** (= `./mvnw -T1 test -Dmaven.build.cache.enabled=false`, serial).
- Per-module JTE-compile harnesses (real `.jte` compile against the typed jte-models facade):
  - `lievit-ui/test/jte-compile/run.sh`
  - `lievit-kit/test/jte-compile/run.sh`

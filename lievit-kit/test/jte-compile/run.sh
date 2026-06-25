#!/usr/bin/env bash
#
# Copyright 2026 Francesco Bilotta
# Licensed under the Apache License, Version 2.0 (the "License").
#
# Real-compiler smoke + RENDER gate for the lievit-kit production JTE chrome (all kit/*.jte parts).
# RFC 0036 stage 3: staging now uses the canonical import recipe:
#   - lievit-maven-plugin:stage-templates extracts lievit/** from the lievit-ui jar
#   - maven-resources-plugin stages kit/** from the source tree alongside
# LievitIcons is compiled into the lievit-ui jar and arrives via the lievit-kit transitive
# dependency — no filesystem icon source root needed any more.
#
# Usage:  ./lievit-kit/test/jte-compile/run.sh   (from anywhere)
# CI:     same command; non-zero exit = a template failed to compile OR a render test failed.
#
set -eo pipefail

# sdkman puts java + maven on PATH for non-login shells. Source it BEFORE `set -u`.
if [ -s "${SDKMAN_DIR:-$HOME/.sdkman}/bin/sdkman-init.sh" ]; then
  # shellcheck disable=SC1091
  source "${SDKMAN_DIR:-$HOME/.sdkman}/bin/sdkman-init.sh"
fi
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"

echo "[kit-jte-compile] installing lievit-ui + lievit-maven-plugin + lievit-kit into the local"
echo "[kit-jte-compile] repo (provides the jars + plugin the harness pom resolves) ..."
( cd "$ROOT" && ./mvnw -q -pl lievit-ui,lievit-maven-plugin,lievit-kit -am install -DskipTests -Dmaven.test.skip=true )

echo "[kit-jte-compile] generating + compiling all staged kit/**/*.jte + lievit/**/*.jte, then"
echo "[kit-jte-compile] running all render tests (gg.jte 3.2.4) ..."
mvn -q -f "$HERE/pom.xml" clean test

echo "[kit-jte-compile] OK: kit chrome compiled clean + render tests passed."

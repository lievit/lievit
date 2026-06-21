#!/usr/bin/env bash
#
# Copyright 2026 Francesco Bilotta
# Licensed under the Apache License, Version 2.0 (the "License").
#
# Real-compiler smoke + RENDER gate for the lievit-kit canonical table chrome (kit/table.jte).
# Generates + javac-compiles the staged kit/**/*.jte + lievit-ui partials against io.lievit.kit +
# lievit-core + the icon SPI (FAILS on any JTE syntax / resolution error), then runs the render test
# (KitTableChromeRenderTest) which renders a real AdminListView fixture and asserts the 14 Filament
# chrome pieces land. Same gg.jte 3.2.4 the gest target uses.
#
# Usage:  ./lievit-kit/test/jte-compile/run.sh   (from anywhere)
# CI:     same command; non-zero exit = a template failed to compile OR the chrome did not render.
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

echo "[kit-jte-compile] installing the lievit-kit artifact (so the templates compile against the"
echo "[kit-jte-compile] real view-model bytecode) ..."
( cd "$ROOT" && ./mvnw -q -pl lievit-kit -am install -DskipTests -Dmaven.test.skip=true )

echo "[kit-jte-compile] generating + compiling kit/table.jte + the lievit-ui partials, then the"
echo "[kit-jte-compile] KitTableChromeRenderTest (gg.jte 3.2.4) ..."
mvn -q -f "$HERE/pom.xml" clean test

echo "[kit-jte-compile] OK: kit table chrome compiled clean + the 14 Filament pieces rendered."

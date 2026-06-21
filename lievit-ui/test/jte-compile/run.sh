#!/usr/bin/env bash
#
# Copyright 2026 Francesco Bilotta
# Licensed under the Apache License, Version 2.0 (the "License").
#
# Real-compiler smoke + typed-facade gate for the lievit-ui JTE partials + blocks.
# Generates + javac-compiles EVERY registry/jte/**/*.jte with the same gg.jte 3.2.4 the
# gest target uses (FAILS on any JTE syntax / resolution error the vitest golden tests
# cannot catch), AND generates the jte-models typed `Templates` facade for the partials,
# then runs TypedFacadeTest which resolves real components through it (compile-checked).
#
# Usage:  ./test/jte-compile/run.sh        (from the lievit-ui dir, or anywhere)
# CI:     same command; non-zero exit = a template failed to compile OR the typed API broke.
#
set -eo pipefail

# sdkman puts java + maven on PATH for non-login shells. sdkman-init references
# some vars unguarded, so source it BEFORE enabling `set -u`.
if [ -s "${SDKMAN_DIR:-$HOME/.sdkman}/bin/sdkman-init.sh" ]; then
  # shellcheck disable=SC1091
  source "${SDKMAN_DIR:-$HOME/.sdkman}/bin/sdkman-init.sh"
fi
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[jte-compile] generating + compiling every registry/jte/**/*.jte + the jte-models facade,"
echo "[jte-compile] then running the typed-facade usage test, with gg.jte 3.2.4 ..."
mvn -q -f "$HERE/pom.xml" clean test

echo "[jte-compile] OK: all JTE partials + blocks compiled clean; typed facade proven."

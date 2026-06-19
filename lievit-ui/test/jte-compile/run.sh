#!/usr/bin/env bash
#
# Copyright 2026 Francesco Bilotta
# Licensed under the Apache License, Version 2.0 (the "License").
#
# Real-compiler smoke for the lievit-ui JTE partials + blocks (issue #462, JOB 2).
# Precompiles EVERY registry/jte/**/*.jte with the same gg.jte 3.2.4 compiler gest
# uses and FAILS on any JTE syntax / resolution error. The vitest golden tests assert
# on source text only and cannot catch a real JTE compile error; this closes that gap.
#
# Usage:  ./test/jte-compile/run.sh        (from the lievit-ui dir, or anywhere)
# CI:     same command; non-zero exit = at least one template failed to compile.
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

echo "[jte-compile] precompiling every registry/jte/**/*.jte with gg.jte 3.2.4 ..."
mvn -q -f "$HERE/pom.xml" clean process-classes

echo "[jte-compile] OK: all JTE partials + blocks compiled clean."

# ADR-0084: RFC-4180 CSV via Apache Commons CSV, retire the hand-rolled CSV

- **Status:** accepted
- **Date:** 2026-06-23
- **Deciders:** Francesco Bilotta

## Context

`lievit-kit` ships an import/export feature (the Filament `Exporter`/`Importer` analogue). Until now
the CSV byte-level mechanics were hand-rolled in three places:

- `CsvFormat.assemble` (export) hand-wrote the RFC-4180 quoting: quote a cell when it contains the
  separator, the quote char, a CR or an LF, and double embedded quotes.
- `CsvSource` (import) hand-wrote a character-by-character tokenizer with an `inQuotes` state machine,
  doubled-quote unescaping, and a blank-row skip.
- `ImportAction.failedRowsCsv` hand-wrote its own `csvLine`/`escape` for the failed-rows report.

CSV is **data-critical**: the RFC-4180 edge cases (a field containing the delimiter, a field
containing a quote, a field containing a newline, leading/trailing spaces, the empty field, doubled
quotes) are exactly where a hand-rolled implementation silently corrupts data rather than failing
loudly. The `CsvSource` javadoc itself admitted it was "not a full RFC-4180 library, but enough".
"Enough" is the wrong bar for a parser whose failures are silent data loss. The in-house code failed
the build-vs-buy cost test: maintaining a correct, fuzzed CSV codec is not the kit's job when a
canonical, battle-tested one exists.

## Decision

Replace the hand-rolled CSV mechanics with **Apache Commons CSV** (`org.apache.commons:commons-csv`,
Apache-2.0, RFC-4180), pinned to `1.14.1` in `lievit-kit/pom.xml` (the Spring Boot BOM does not
manage it).

- **Export** serializes through `CSVPrinter` over `CSVFormat.RFC4180`, configured with the dialect's
  separator / quote / line ending. The UTF-8 BOM option and the dialect presets stay in `CsvFormat`.
- **Import** parses through `CSVParser` over `CSVFormat.RFC4180` with `ignoreEmptyLines`. The kit
  keeps only what the library does not do: stripping a leading UTF-8 BOM and auto-detecting the
  delimiter from the header line.
- **Failed-rows report** writes through `CSVPrinter` (comma, LF) instead of the hand-rolled writer.

Commons CSV was chosen over OpenCSV because `lievit-kit` already owns its column model
(`ExportColumn`/`ImportColumn`); Commons CSV's lower-level `CSVPrinter`/`CSVParser` map cleanly onto
that model without imposing OpenCSV's bean-binding conventions.

**Only the byte-level mechanics change.** The public surface is preserved: the column model, the
`Exporter`/`Importer` contracts, the `ExportAction`/`ImportAction`/`ExportBulkAction` actions, the
`CsvFormat` presets, the BOM option, and delimiter auto-detection keep their signatures and
behaviour.

## Consequences

- The RFC-4180 edge cases are now the library's responsibility, fuzzed and maintained upstream. A
  round-trip suite (`RfcCsvRoundTripTest`) pins export→import losslessness for the delimiter, quote,
  newline, surrounding-space, empty-field, and formula-looking cases under both the comma and the
  semicolon dialect.
- One visible behaviour improvement falls out of the correct library: a field with leading/trailing
  spaces is now quoted on export, so a downstream reader that trims unquoted fields cannot eat the
  spaces. The retired hand-rolled writer left such a field unquoted. This is strictly safer and still
  RFC-4180-valid; the round-trip test proves the value survives unchanged.
- `lievit-kit` gains one small, well-known runtime dependency. The kit is the admin layer, not the
  persistence-agnostic floor, so a focused CSV dependency there is acceptable; `lievit-core` stays
  pure.

## Alternatives considered

**Keep the hand-rolled CSV.** Rejected: it is data-critical code with silent-corruption failure
modes, and the in-house parser was self-described as not fully RFC-4180. The cost of owning a correct
CSV codec is not worth it when a canonical one exists.

**OpenCSV.** Rejected: it leans on bean/annotation binding conventions that fight the kit's own
`ExportColumn`/`ImportColumn` column model; Commons CSV's lower-level printer/parser map onto that
model with no impedance.

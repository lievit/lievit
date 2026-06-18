# ADR-0044: File uploads (signed temp files + direct upload) and the `download` effect

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta
- **Issues:** #161, #189, #191 (Epic #34, #159)

## Context

Two file-handling capabilities had to land without breaking the stateless wire invariant: the
snapshot carries state, never bytes (state-never-code, wire-protocol.md §2). A 12 MiB base64 payload
on the wire would defeat the snapshot budget and the HMAC signing.

- **Uploads** (issues #159, #189, #191, the Livewire `TemporaryUploadedFile` / S3 presigned-upload
  analogues): the browser must be able to upload a file, the component must validate it (size,
  extension) and move it to permanent storage, and the `@Wire` property must survive the round trip
  as a reference, not the content. lievit assumes no ORM and no specific storage backend.
- **The `download` effect** (issue #161, `$this.download`): an action must be able to return a file
  to the browser as a download instead of a page swap. The wire protocol reserved the `download`
  effect key (wire-protocol.md §5b); this realizes it. The code previously mislabeled this work as
  ADR-0037 (locale pinning); it has its own ADR now.

## Decision

**Upload protocol (signed temp file).** The bytes are uploaded out-of-band to an additive controller,
never on the snapshot:

- **`POST /lievit/upload`** (`LievitUploadController`, starter): validate each file (size +
  allowed-extension; the file-name extension is the non-spoofable check, not the client-sent mime),
  store it under a temp root, and return one **HMAC-signed relative temp path** per file. The
  `@Wire` field is set to that signed token.
- **`TempFileSigner` + `SignedTempPath`** (core, pure): HMAC-SHA-256 over `<relative-path>.<expiry>`,
  constant-time compare. `verify` rejects path traversal (`..`, leading `/`, backslash, NUL) and
  expired tokens, so a forged or leaked token cannot escape the temp root or outlive its TTL
  (default 30 min, the preview window). The signed token is the only thing that ever crosses the
  wire for an uploaded file.
- **`TemporaryUploadedFile`** (core) is the `@Wire` value: it holds the signed token + client name +
  size + mime, implements `Wireable` (so the existing `WireableSynthesizer` dehydrates/hydrates it,
  no new synth), runs `validate(UploadConstraints)`, then `store(FileStore, dir)`.
- **`FileStore` SPI** (core, issue #189): the single seam for moving validated temp bytes to
  permanent storage. The starter ships `LocalFileStore` (local filesystem) as the default; an
  adopter storing to GCS/S3/CDN implements the interface and registers a bean ("ship a default,
  adopter adapts").
- **`DirectUploadProvider` SPI + `DirectUpload`** (core, issue #191): the opt-in direct-to-object-
  storage path. `POST /lievit/upload/presign` returns a presigned per-file PUT descriptor so the
  browser uploads straight to object storage with no proxy through the app. No cloud default ships
  (default is "off"): with no provider bean the upload proxies through `/lievit/upload`. `presign`
  is **per-file by contract** (a presigned PUT addresses exactly one object), so multiple+direct is
  N presigns, never one bundled PUT.
- **`GET /lievit/upload/preview?t=<token>`**: a signed, expiry-bounded preview of a stored temp file;
  the signer rejects forged/expired/traversal tokens before any file is read.

**`download` effect.** `DownloadEffect(name, base64, contentType)` (core) rides the `Lievit-Effects`
header base64-encoded; the client decodes it into a Blob and triggers a browser download while the
component still re-renders. `of(name, bytes, ct)` / `ofText(name, text, ct)` build it. The base64
ride-along suits the common report/CSV case under the snapshot budget; a large export should redirect
to a streaming endpoint instead.

## Consequences

- The wire never carries file bytes: an upload survives the round trip as a signed reference, a
  download rides the effects header. The snapshot stays small and HMAC-signed.
- The two SPIs (`FileStore`, `DirectUploadProvider`) keep lievit backend-agnostic: the local
  default works out of the box, cloud storage is an adopter bean, no ORM assumed.
- The upload controller is additive (a route, not a dispatcher rewrite, ADR-0019) and inherits the
  page's Spring Security context over `/lievit/**` (CSRF + auth, wire-protocol.md §7).
- The core upload primitives are pure (zero Spring, ADR-0007); only the starter touches the
  filesystem and the HTTP routes. Error responses stay coarse on the preview path (fail-closed,
  ADR-0014): the endpoint does not confirm whether a path exists to a probe.

## Alternatives considered

- **Carrying upload bytes on the snapshot** (base64 in the `@Wire` field): rejected. It breaks the
  snapshot budget, balloons the signed payload, and re-uploads the file on every wire call.
- **Shipping a cloud `FileStore` default** (e.g. a GCS implementation): rejected. lievit assumes no
  specific backend; the local filesystem default plus the SPI keeps the core dependency-free and
  lets the adopter pick storage.
- **Allowing one presigned PUT to carry multiple files**: rejected. A presigned PUT addresses a
  single object; bundling would be a silent, backend-specific deviation. `presign` is per-file.

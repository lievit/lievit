/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Release tokens + back-forward-cache disabling (ADR-0024, #105 + disabling-back-button-cache).
 *
 * After a deploy, a tab that loaded the *old* build still carries snapshots signed by the old
 * release. Two hazards follow: (1) the old client POSTs a stale snapshot and gets a `409`/`410`
 * it could surface as a scary error instead of a clean re-mount; (2) the browser's back-forward
 * cache (bfcache) can restore an entire old-release page from memory, so the user navigates "back"
 * into a stale app that then POSTs against the new server.
 *
 * The host page stamps `data-lievit-release="<build-token>"` on `<html>`. The server echoes its
 * active release in a `release` effect. {@link releaseMismatch} compares them; on a mismatch the
 * runtime treats the next stale-snapshot failure as expected (a clean re-mount, not an error).
 * {@link disableBfcache} reloads a page restored from bfcache so it never runs against a moved-on
 * server.
 *
 * Strict-CSP-safe: a `pageshow` listener registered in this module, never inline script.
 */

/** The attribute the host page stamps the build's release token on (`<html>`). */
export const RELEASE_ATTR = "data-lievit-release";

/**
 * Reads the client's release token from the document root (`<html data-lievit-release="...">`).
 *
 * @param doc the document (defaults to the global `document`); injectable for tests
 * @returns the release token, or `null` if the page did not stamp one
 */
export function clientRelease(doc: Document = document): string | null {
  return doc.documentElement.getAttribute(RELEASE_ATTR);
}

/**
 * Whether the server's active release differs from the client's (a deploy moved on while this tab
 * was open). A `null` on either side (no token stamped / no `release` effect) is treated as "no
 * mismatch" so the feature is opt-in and never false-positives on a page that does not use it.
 *
 * @param serverRelease the `release` effect value (the server's active release), or `null`
 * @param clientToken the client's stamped token (defaults to reading the document)
 * @returns true when both are present and differ
 */
export function releaseMismatch(
  serverRelease: string | null | undefined,
  clientToken: string | null = clientRelease(),
): boolean {
  if (serverRelease == null || clientToken == null) {
    return false;
  }
  return serverRelease !== clientToken;
}

/**
 * Disables the back-forward cache for this page: when the page is restored from the bfcache
 * (`pageshow` with `persisted === true`), reload it so a stale-release page never runs against a
 * moved-on server (#105, disabling-back-button-cache).
 *
 * @param target the event target to listen on (defaults to `window`); injectable for tests
 * @param reload the reload action (defaults to `window.location.reload`); injectable for tests
 * @returns an unsubscribe function that removes the listener
 */
export function disableBfcache(
  target: EventTarget = window,
  reload: () => void = () => window.location.reload(),
): () => void {
  const listener = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) {
      reload();
    }
  };
  target.addEventListener("pageshow", listener);
  return () => target.removeEventListener("pageshow", listener);
}

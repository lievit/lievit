/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Surgical snapshot merge (ADR-0024, #87): the heart of v4 reactivity. After a wire call returns
 * the server's authoritative `@Wire` state, the client must NOT clobber an edit the user made to a
 * *different* prop while the request was in flight. {@link mergeNewSnapshot} reconciles three
 * inputs:
 *
 * - `base` — the wire state the client held when the request was sent (the pre-flight baseline);
 * - `server` — the authoritative wire state the response carried;
 * - `pending` — the field paths the client edited locally and has NOT yet committed.
 *
 * The rule (Livewire `mergeNewSnapshot`): for every path, the server value wins **unless** the
 * client has a pending edit there AND the server did not change that path from the baseline. A
 * pending edit to an untouched path survives; a same-path server change is authoritative (the
 * server's intent overrides a stale local edit). This is what lets "edit prop A while a request
 * mutating prop B is in flight" preserve A (#87 acceptance).
 *
 * Path subtleties handled: dot-keyed nested paths (`a.b.c`), array element removal (reverse-indexed
 * so deleting index 2 then 4 targets the right elements), key order preserved (insertion order),
 * and a large/sparse numeric key stays a keyed object rather than being widened to an N-element
 * array (so `{ "1000": x }` does not allocate a thousand-slot array).
 *
 * Pure data, no DOM, strict-CSP-safe.
 */

/** A JSON-shaped wire value: the only thing the wire carries (state, never code). */
export type WireValue =
  | string
  | number
  | boolean
  | null
  | WireValue[]
  | { [key: string]: WireValue };

/** A flat map of `@Wire` field name -> value (the snapshot's decoded `wire`). */
export type WireState = Record<string, WireValue>;

/** Returns true for a plain JSON object (not an array, not null). */
function isObject(value: unknown): value is Record<string, WireValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural deep-equality over JSON-shaped values (order-insensitive for object keys). */
export function deepEqual(a: WireValue, b: WireValue): boolean {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]!));
  }
  if (isObject(a) && isObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    return (
      ak.length === bk.length && ak.every((k) => k in b && deepEqual(a[k]!, (b as WireState)[k]!))
    );
  }
  return false;
}

/** Splits a dot path `a.b.c` into `["a","b","c"]`; a bare `a` is `["a"]`. */
function pathSegments(path: string): string[] {
  return path.split(".");
}

/**
 * Keys that must never be walked or written, because writing them mutates the JS prototype chain
 * instead of the wire snapshot (prototype-pollution). Path segments arrive partly from the wire
 * (server snapshot keys + client `pending` paths reconciled on every response), so a hostile
 * `__proto__.polluted` / `constructor.prototype.x` segment must be refused, not honoured.
 */
const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

/** True if any segment of the path is a prototype-pollution sink (`__proto__`/`prototype`/`constructor`). */
function isUnsafePath(segs: readonly string[]): boolean {
  return segs.some((seg) => FORBIDDEN_SEGMENTS.has(seg));
}

/** Reads the value at a dot-path from a wire value, or `undefined` if any segment is missing. */
export function readPath(state: WireValue, path: string): WireValue | undefined {
  const segs = pathSegments(path);
  // A prototype-pollution segment can never name real wire data: treat the path as absent.
  if (isUnsafePath(segs)) {
    return undefined;
  }
  let cursor: WireValue | undefined = state;
  for (const seg of segs) {
    if (Array.isArray(cursor)) {
      const i = Number.parseInt(seg, 10);
      cursor = Number.isInteger(i) ? cursor[i] : undefined;
    } else if (isObject(cursor)) {
      cursor = cursor[seg];
    } else {
      return undefined;
    }
    if (cursor === undefined) {
      return undefined;
    }
  }
  return cursor;
}

/**
 * Writes `value` at a dot-path into `state` (mutating), creating intermediate objects as needed. A
 * numeric segment whose parent is already an array indexes the array; otherwise it becomes an
 * object key (so a large/sparse numeric key stays a keyed object, never widening an array).
 */
export function writePath(state: WireState, path: string, value: WireValue): void {
  const segs = pathSegments(path);
  // Refuse to walk/write a prototype-pollution path (`__proto__`/`prototype`/`constructor`): such a
  // segment names the JS prototype chain, not wire data, so honouring it would mutate Object.prototype.
  if (isUnsafePath(segs)) {
    return;
  }
  let cursor: Record<string, WireValue> | WireValue[] = state;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    const next: WireValue | undefined = Array.isArray(cursor)
      ? cursor[Number.parseInt(seg, 10)]
      : (cursor as Record<string, WireValue>)[seg];
    if (!isObject(next) && !Array.isArray(next)) {
      const created: Record<string, WireValue> = {};
      if (Array.isArray(cursor)) {
        cursor[Number.parseInt(seg, 10)] = created;
      } else {
        cursor[seg] = created;
      }
      cursor = created;
    } else {
      cursor = next;
    }
  }
  const last = segs[segs.length - 1]!;
  if (Array.isArray(cursor)) {
    cursor[Number.parseInt(last, 10)] = value;
  } else {
    cursor[last] = value;
  }
}

/**
 * Removes the elements at the given array indices from `array`, reverse-indexed so earlier removals
 * do not shift the targets of later ones. Returns a new array (does not mutate the input).
 *
 * @param array the source array
 * @param indices the indices to remove (any order)
 * @returns a new array with those indices removed
 */
export function removeIndices(array: WireValue[], indices: readonly number[]): WireValue[] {
  const drop = new Set(indices);
  return array.filter((_, i) => !drop.has(i));
}

/** The instruction set a surgical merge consumes: which paths were edited / removed client-side. */
export interface MergeIntent {
  /** Dot-paths the client edited locally (and has not committed): preserve if the server agrees. */
  readonly pendingPaths: readonly string[];
  /** Per-array-path indices the client removed locally: reverse-indexed on apply. */
  readonly removals?: Readonly<Record<string, readonly number[]>>;
}

/**
 * Merges the server's authoritative wire state with the client's in-flight edits (the surgical
 * merge, #87). Starts from a deep clone of `server` (the server is authoritative), then re-applies
 * each pending client edit whose path the server did NOT change relative to `base` (so an unsaved
 * edit to an untouched prop survives; a same-path server change wins). Finally applies any local
 * array removals (reverse-indexed).
 *
 * @param base the wire state the client held when the request was sent
 * @param server the authoritative wire state the response carried
 * @param intent the client's pending edits + removals
 * @returns the merged wire state the client should now hold
 */
export function mergeNewSnapshot(
  base: WireState,
  server: WireState,
  intent: MergeIntent,
): WireState {
  const merged = structuredCloneJson(server);

  for (const path of intent.pendingPaths) {
    const baseVal = readPath(base, path);
    const serverVal = readPath(server, path);
    // The server changed this path from the baseline → its value is authoritative, keep it.
    if (!sameMaybe(baseVal, serverVal)) {
      continue;
    }
    // The server did not touch this path; re-apply the client's in-flight edit onto the merged
    // state by reading it from the base (the base holds the client's optimistic value at send time).
    const pendingVal = readPath(base, path);
    if (pendingVal !== undefined) {
      writePath(merged, path, pendingVal);
    }
  }

  for (const [path, indices] of Object.entries(intent.removals ?? {})) {
    const target = readPath(merged, path);
    if (Array.isArray(target)) {
      writePath(merged, path, removeIndices(target, indices));
    }
  }

  return merged;
}

/** Deep-equal that treats two `undefined`s as equal (a path absent on both sides is unchanged). */
function sameMaybe(a: WireValue | undefined, b: WireValue | undefined): boolean {
  if (a === undefined && b === undefined) {
    return true;
  }
  if (a === undefined || b === undefined) {
    return false;
  }
  return deepEqual(a, b);
}

/** A small JSON deep clone (structuredClone may be unavailable in some test envs; this is enough). */
function structuredCloneJson(value: WireState): WireState {
  return JSON.parse(JSON.stringify(value)) as WireState;
}

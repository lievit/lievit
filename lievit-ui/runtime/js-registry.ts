/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The CSP-safe replacement for Livewire's `$js` / inline `@js` / per-component `<script>` (ADR-0024,
 * #131 and the `$js` cluster). Livewire registers JS behavior as inline script the server can
 * trigger by name; lievit's strict CSP drops inline script silently (a shipped-once bug, repo
 * CLAUDE.md). So a lievit `$js` handler is a named function **registered in a TS module** the page
 * imports, never an eval'd string and never inline.
 *
 * The server (or a template) references the behavior **by name** (a `js` effect carries
 * `{name, args}`); the runtime looks the name up here and calls it. An unknown name is a logged
 * no-op, never an `eval`/`new Function`. This keeps the whole `$js` surface inside the CSP.
 */

/** A registered client function: receives the call args and an element context (the bound root). */
export type JsHandler = (args: readonly unknown[], context: JsContext) => unknown;

/** The context a `$js` handler runs in (the component root, when invoked from a component). */
export interface JsContext {
  /** The component root the call originated from, or `null` for a global invocation. */
  readonly root: Element | null;
}

/** One `js` effect entry: a named handler to invoke with args (the server's CSP-safe `$js` call). */
export interface JsEffectCall {
  readonly name: string;
  readonly args?: readonly unknown[];
}

/**
 * A registry of named client functions. The runtime owns one; a page's `main.ts` registers its
 * `$js` handlers against it (`runtime.js.register("highlight", fn)`), and the server triggers them
 * by name via the `js` effect. The registry IS the allowlist: only a registered name can run, so a
 * tampered effect naming an unknown handler is a no-op, not code execution.
 */
export class JsRegistry {
  private readonly handlers = new Map<string, JsHandler>();
  private readonly onMissing: (name: string) => void;

  /**
   * @param onMissing reporter for a `js` effect naming an unregistered handler (defaults to a
   *   `console.warn`); injectable so a test can assert the no-op without a real console.
   */
  constructor(onMissing?: (name: string) => void) {
    this.onMissing =
      onMissing ?? ((name) => console.warn(`[lievit] no $js handler registered for "${name}"`));
  }

  /**
   * Registers (or replaces) a named handler.
   *
   * @param name the handler name the server/template references
   * @param handler the function to run
   * @returns an unsubscribe function
   */
  register(name: string, handler: JsHandler): () => void {
    this.handlers.set(name, handler);
    return () => {
      if (this.handlers.get(name) === handler) {
        this.handlers.delete(name);
      }
    };
  }

  /**
   * @param name the handler name
   * @returns true if a handler is registered under that name
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Invokes a registered handler by name. An unknown name is reported and returns `undefined` (a
   * no-op): never an eval, never a throw that breaks the call.
   *
   * @param name the handler name
   * @param args the call args (from the `js` effect)
   * @param context the element context (the component root, or `null`)
   * @returns the handler's return value, or `undefined` if the name is unknown
   */
  invoke(name: string, args: readonly unknown[] = [], context: JsContext = { root: null }): unknown {
    const handler = this.handlers.get(name);
    if (handler == null) {
      this.onMissing(name);
      return undefined;
    }
    return handler(args, context);
  }

  /**
   * Applies a list of `js` effect calls (the `js` key of the effects bag) in order.
   *
   * @param calls the `{name, args}[]` from the `js` effect
   * @param context the element context for every call
   */
  applyEffect(calls: readonly JsEffectCall[], context: JsContext = { root: null }): void {
    for (const call of calls) {
      this.invoke(call.name, call.args ?? [], context);
    }
  }
}

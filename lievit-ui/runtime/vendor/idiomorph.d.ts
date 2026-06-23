/*
 * Hand-written type declarations for the vendored Idiomorph (runtime/vendor/idiomorph.js).
 * Idiomorph ships as JSDoc-annotated JS; this `.d.ts` types only the surface lievit's morph
 * wiring consumes (Idiomorph.morph + the callbacks/config it passes). It is NOT vendored upstream
 * code: it is the lievit-side contract against the pinned v0.7.4 API. Keep it in lockstep with the
 * vendored version on upgrade. SPDX-License-Identifier: Apache-2.0 (this file), 0BSD (idiomorph.js).
 */

/** The morph callbacks lievit drives (subset of Idiomorph's ConfigCallbacks). */
export interface IdiomorphCallbacks {
  /** Before a node is morphed in place; return `false` to skip morphing it (and its subtree). */
  readonly beforeNodeMorphed?: (oldNode: Node, newNode: Node) => boolean | void;
  /** After a node finished morphing (attributes + children done). */
  readonly afterNodeMorphed?: (oldNode: Node, newNode: Node) => void;
  /** Before a leftover live node is removed; return `false` to keep it in place. */
  readonly beforeNodeRemoved?: (node: Node) => boolean | void;
  /** Before an attribute is updated/removed on a node; return `false` to skip that mutation. */
  readonly beforeAttributeUpdated?: (
    attributeName: string,
    node: Element,
    mutationType: "update" | "remove",
  ) => boolean | void;
}

/** The Idiomorph config subset lievit sets. */
export interface IdiomorphConfig {
  /** `"outerHTML"` morphs the node itself (attrs incl.); `"innerHTML"` morphs only its children. */
  readonly morphStyle?: "outerHTML" | "innerHTML";
  /** Restore focus + selection of the active input/textarea across the morph (default true). */
  readonly restoreFocus?: boolean;
  /** Leave the active element's `value` untouched (it is the user's in-flight typing). */
  readonly ignoreActiveValue?: boolean;
  readonly callbacks?: IdiomorphCallbacks;
}

export interface IdiomorphApi {
  /**
   * Morphs `oldNode` toward `newContent` (an HTML string, a node, or a node list).
   * @returns the resulting top-level nodes, or undefined.
   */
  morph(
    oldNode: Element | Document,
    newContent: string | Node | null,
    config?: IdiomorphConfig,
  ): Node[] | undefined;
  readonly defaults: IdiomorphConfig;
}

export const Idiomorph: IdiomorphApi;

# Directives reference

A directive is an `l:*` attribute the client runtime binds in the rendered HTML, turning DOM events
into wire calls or reflecting server state into the DOM. This page lists every directive that ships
today, grouped by where it lives in the bundle. All snippets are from the runtime test suite
(`lievit-ui/runtime/*.test.ts`).

## Core directives (always on)

Registered by `builtinDirectives()` in `lievit-ui/runtime/directives.ts`. These are the wire
protocol's directives ([wire protocol §5](../wire-protocol.md#5-client-directives-lmodel-modifiers-and-idiomorph-patching)).

### `l:click="action"`

Invokes a `@LievitAction` on click.

```html
<button l:click="increment">+</button>
```

### `l:submit="action"`

Prevents the native form submit, then invokes the action.

```html
<form l:submit="save"> ... </form>
```

### `l:keydown.<key>="action"`

Invokes the action on a specific key. The most common is Enter:

```html
<input l:keydown.enter="submit">
```

A keydown of any other key is ignored; only the named key fires the action.

### `l:model[.modifier]="field"`

Binds an input's value bidirectionally to a `@Wire` field. The modifier controls **when** the change
is sent to the server:

| Modifier | Sends the update when | Use for |
|---|---|---|
| `l:model` (none) | **never on its own**: held client-side, rides the next action (the deferred default) | the common text-input case |
| `l:model.live` | on every `input` event, debounced ~150 ms | live-search, instant feedback (sparingly) |
| `l:model.lazy` | on `change` (the field commits / loses focus) | fields that only matter when finished |
| `l:model.blur` | on `blur` (focus leaves) | validate-on-leave fields |
| `l:model.debounce.Xms` | debounced by the explicit interval (implies `.live`) | tuning the live window |

`l:model` is **deferred by default**: it sends no network request while the user types and rides
along with the next action, which is what makes a typical form interactive at zero per-keystroke
cost. `.live` is the explicit opt-in to per-keystroke traffic. The client reads checkboxes as a
boolean and other inputs as their string value.

```html
<input l:model="name">              <!-- deferred: synced with the next action -->
<input l:model.live="query">        <!-- per-keystroke, debounced ~150 ms -->
<input l:model.lazy="title">        <!-- on change -->
<input l:model.blur="email">        <!-- on blur -->
<input l:model.debounce.300ms="q">  <!-- explicit debounce window -->
```

## v4 directives (additive, ADR-0024)

Registered through one `registerV4Directives()` (`lievit-ui/runtime/v4-directives.ts`), all built on
the ADR-0019 client seams. They reflect server/ephemeral state into the DOM or extend the input set.

### `l:bind.<attr>="field"` (#75)

Reflects a field's ephemeral value onto a DOM attribute on every model change. Boolean attributes
(`disabled`, `checked`, `readonly`, `hidden`) toggle presence; others set the stringified value.

```html
<button l:bind.disabled="saving">Save</button>   <!-- present iff saving is truthy -->
```

### `l:text="field"` (#77)

Binds an element's `textContent` to a field's ephemeral value (reflects immediately on bind and on
every later change).

```html
<span l:text="name"></span>
```

### `l:dirty` (#85)

Shows the element only while its component has uncommitted edits. Hidden when clean.

```html
<em l:dirty>unsaved changes</em>
```

### `l:error="field"` / `l:errors` (#101)

`l:error` renders a field's first validation message from the `errors` effect (hidden before any
call, shown when the effect carries it). `l:errors` marks a container the effect's presence toggles.

```html
<small l:error="email"></small>
```

### `l:ref="name"` (#109)

Registers a named element reference scoped to its component (a stable handle for client code).

```html
<input l:ref="search">
```

### `l:sort="field"` (#111)

Drag-to-reorder a list; commits the new order of `data-lievit-sort-key` values as a model update.

```html
<ul l:sort="order">
    <li data-lievit-sort-key="a">A</li>
    <li data-lievit-sort-key="b">B</li>
</ul>
```

### `l:loading` (#125)

Disables form controls while a wire call is in flight (re-enables on the response).

```html
<button l:loading>Save</button>
```

### `l:island="name"` (#89)

Targets an action to a single named region so the server re-renders only that fragment. See
[islands](islands.md).

```html
<button l:island="counter" l:click="inc">+</button>
```

## Optional features (opt-in, ADR-0024)

These live under `lievit-ui/runtime/features/` and are installed by `installAllFeatures()` (or
individually). They are CSP-safe (no inline `eval`).

| Directive | Effect |
|---|---|
| `l:show="expr"` | Toggle visibility via inline `display` without removing the node from the DOM. |
| `l:confirm="message"` | Native confirmation dialog before an action. |
| `l:confirm.prompt="message\|requiredText"` | Require a typed string to confirm. |
| `l:navigate[.hover]="url"` | SPA-style navigation (optionally prefetch on hover). |
| `l:ignore[.self\|.children]` | Exclude an element / subtree from morphing (preserve third-party DOM). |
| `l:current[.exact]="class"` | Mark the active link (default class `active`). |
| `l:click.async` | Run the action concurrently instead of queueing it behind in-flight calls. |

## Magic actions in an `l:*` expression

An `l:*` directive can invoke a magic action with no method on the component. The server resolves it
and applies the same settable allowlist a `wire:model` update obeys (a `$set` on a locked or unknown
field is silently dropped):

```html
<button l:click="$set('open', true)">Open</button>
<button l:click="$toggle('open')">Toggle</button>
<button l:click="$refresh">Refresh</button>
<button l:click="$dispatch('saved', { id: 7 })">Done</button>
```

`$set` / `$toggle` / `$refresh` / `$get` / `$parent` are the magic actions; `$dispatch` is a global
event dispatch (see [events](events.md)).

## DOM patching, not innerHTML

The 200 response body is the freshly rendered HTML for the component. The client does **not** replace
`innerHTML` and runs no virtual DOM. A small bespoke morph (`lievit-ui/runtime/morph.ts`) walks the
live DOM toward the new markup, preserving DOM identity where the structure matches, so focus,
selection, scroll position, in-flight CSS transitions, and uncontrolled input state survive the
patch. Keyed nodes (`id`, then `name`) are reused/moved rather than rebuilt. See
[ADR-0019](../adr/0019-client-runtime-bundle.md).

## Not implemented

`l:offline` is not implemented. Everything else listed above ships in the current bundle.

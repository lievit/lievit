# Islands

An island is a named region of a component that re-renders independently of the rest. An action
targeted at an island returns only that fragment, and the client morphs only that region, leaving the
rest of the component's DOM untouched ([ADR-0024](../adr/0024-v4-client-convergence.md), #89).

This is lighter than a nested component: an island has no separate snapshot or lifecycle; it is a
slice of one component's render that the wire call scopes to.

## Declaring an island

The server wraps an island's output in HTML-comment markers. The comments are inert to the browser
and to the morph, invisible to the user, and parsed only by the client:

```html
<!--[lievit:island counter]--><b>${count}</b><!--[/lievit:island counter]-->
```

## Targeting an action at an island

Mark the control with `l:island="<name>"`. The runtime sends the island name in a reserved `_island`
field on the wire call:

```html
<button data-lievit-island="counter" l:island="inc">+</button>
```

```ts
// lievit-ui/runtime/runtime-v4.test.ts — the wire call carries the island name
JSON.parse(init.body)._updates._island === "counter";
```

The server returns only the island fragment(s) and lists which islands re-rendered in an additive
`islands` effect on the `Lievit-Effects` header. A call that re-renders no island omits the key, so a
plain action stays byte-for-byte the pre-island response.

## Client morphing

The client parses the markers and morphs only the named island, preserving the node identity of
everything outside it:

```ts
// lievit-ui/runtime/islands.test.ts
root.innerHTML = `<p id="outside">keep</p>${island("counter", "<span>1</span>")}`;
const outsideBefore = root.querySelector("#outside");

morphIslands(root, parseIslands(island("counter", "<span>2</span>")));

root.querySelector("span").textContent;     // "2" — the island updated
root.querySelector("#outside") === outsideBefore;   // sibling identity preserved
```

## Modes: replace, append, prepend

An island can replace its content (the default), append (feeds, infinite scroll), or prepend:

```ts
// lievit-ui/runtime/islands.test.ts — append then prepend
morphIslands(root, parseIslands(island("feed", "<li>2</li>")), "append");
// li order: ["1", "2"]
morphIslands(root, parseIslands(island("feed", "<li>0</li>")), "prepend");
// li order: ["0", "1", "2"]
```

Multiple response fragments for the same island are deduped (the last fragment wins for `replace`).

## When to reach for an island

- A region that updates far more often than the rest of the component (a live counter, a feed, a
  ticker): scope the wire call to it so you re-render and morph only that slice.
- A list you append to without rebuilding (`append` mode), keeping scroll and the existing items'
  DOM identity intact.

For a region that is its own reactive unit with its own state and lifecycle, reach for a
[nested component](nested-components.md) instead.

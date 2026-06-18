# Computed properties and lifecycle hooks

Two features that shape what a component exposes and when its code runs: `@LievitComputed` derives
values without storing them, and the lifecycle hooks let code run at each phase of a wire call.

## Computed properties (`@LievitComputed`)

A `@LievitComputed` method is a per-request computed property: a no-arg, non-void method called at
most once per wire request, its result memoized and reused within that request, the cache cleared
between requests. It is exposed to the template by method name and **never serialized into the
snapshot**. See [ADR-0015](../adr/0015-computed-properties.md).

```java
@LievitComponent(template = "cart")
public class CartComponent {

    @Wire
    List<Item> items = new ArrayList<>();

    @LievitComputed
    public String totalPrice() {
        return items.stream()
            .map(Item::price)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .toString();
    }
}
```

```html
@param String totalPrice
<p>Total: ${totalPrice}</p>
```

Why it matters:

- **Memoized once per request.** A template that reads `totalPrice` three times computes it once.
- **Not in the snapshot.** A computed value is derived on each render, so the client never sees an
  entry to tamper with, and the snapshot stays small. Anything a client must not be able to set
  belongs in a computed property or a `@LievitProperty(locked = true)` field, never a plain `@Wire`.

The method must be no-arg and return non-void; a void or parameterized method is not a computed
property.

## Lifecycle hooks

Beyond `@LievitMount` and `@LievitRender`, a component can declare the full lifecycle by
**convention-named methods** (no annotation), each fired at its phase. The phase order is fixed and
observable through the lifecycle bus ([ADR-0022](../adr/0022-request-lifecycle-bus.md),
[ADR-0030](../adr/0030-runtime-parity-events-lifecycle-magic-redirects.md)):

```
mount variant:   MOUNT → RENDER → DEHYDRATE → DESTROY
call variant:    HYDRATE → UPDATE → UPDATED → CALL → RENDER → DEHYDRATE → DESTROY
```

| Hook | Runs |
|---|---|
| `boot()` / `booted()` | bracket mount/hydrate (before / after) |
| `hydrate()` / `dehydrate()` | on init from the snapshot / when state is read back into the snapshot |
| `updating()` / `updated()` | before / after any field update is applied |
| `updating{Prop}()` / `updated{Prop}()` | before / after a specific field is written |
| `rendering()` / `rendered()` | bracket the render phase |

The ordering is the contract: `updating` and `updating{Prop}` run **before** the write (they see the
old value); `updated` and `updated{Prop}` run **after** (the new value). The `UPDATED` finishers run
after **all** updates are applied, so one hook can override another. None of these hooks is reachable
as a frontend action; only `@LievitAction` methods are callable from the template.

```java
@LievitComponent(template = "search")
public class SearchComponent {

    @Wire String query = "";

    // runs after `query` changes, before the action that triggered the call
    void updatedQuery() {
        page = 1;   // reset pagination whenever the search term changes
    }
}
```

## The lifecycle bus (client side)

On the client, the same phases are observable through a `LifecycleBus`: a feature registers as a
listener instead of editing the core loop. A hook that throws is isolated (logged via `onHookError`;
the call proceeds). The hook surface:

```ts
// lievit-ui/runtime/lifecycle.ts
interface LifecycleHook {
  onComponentInit?: (ctx) => void;
  onModelChange?:   (ctx, field, value) => void;
  beforeCall?:      (ctx) => void;
  afterCall?:       (outcome) => void;
  onError?:         (outcome) => void;
}
```

```ts
// lievit-ui/runtime/lifecycle.test.ts — ordered around the call
const bus = new LifecycleBus();
bus.register({ beforeCall: () => order.push("before"), afterCall: () => order.push("after") });
// beforeCall fires, the wire call runs, afterCall fires: ["before", "after"]
```

This is the extension point the v4 directives use: `l:loading` registers a `beforeCall`/`afterCall`
pair, `l:dirty` an `onModelChange`, `l:error` an `afterCall`. You can register your own with
`runtime.use(hook)`.

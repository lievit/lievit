# The single-file DSL

Write a component's markup in type-safe Java instead of a separate template. The Java compiler checks
the markup; there is no separate `.jte` file to keep in sync. This is the hard differentiator:
reactive, single-file, type-safe components are impossible in an interpreted stack like PHP's Volt.
The DSL lives in `lievit-dsl` ([ADR-0018](../adr/0018-single-file-dsl.md)).

Single-file is not a trade on type safety: it is "DSL instead of JTE", both are type-safe.

## The counter, single-file

```java
import static dev.lievit.dsl.H.*;

@LievitComponent
public class Counter {

    @Wire int count;

    @LievitAction public void increment() { count++; }
    @LievitAction public void decrement() { count--; }

    @LievitRender
    Html render() {
        return div(
            button(text("-")).wireClick("decrement"),
            span(text(count)),
            button(text("+")).wireClick("increment")
        );
    }
}
```

A `@LievitRender` method that returns `Html` makes the component single-file: the `DslTemplateAdapter`
renders the tree through the same wire pipeline (mount, wire call, effects, morph) as a JTE
component, behind the one `TemplateAdapter` SPI, so the dispatcher and codec are untouched.

## The element factories (`dev.lievit.dsl.H`)

Static-import `H.*` and build the tree with factories:

| Factory | Produces |
|---|---|
| `text(value)` | an escaped text node |
| `raw(html)` | a raw (unescaped) node — the audit-visible escape hatch |
| `fragment(children...)` | a group of sibling nodes with no wrapper |
| `el(tag, children...)` | a validated element with an arbitrary tag |
| `div`, `span`, `p`, `button`, `form`, `label`, `input`, `img`, `h1`–`h3`, `section`, `strong`, `br`, `hr`, ... | the common elements |

`Html` is a sealed interface (`Element`, `TextNode`, `RawNode`, `Fragment`); the tree renders to a
`String` with `.render()`.

## Wire-binding helpers on an element

```java
button(text("Save")).wireClick("save");
form(...).wireSubmit("submit");
input().wireModel("name");
input().wireModelLive("query");
input().wireKeydownEnter("submit");
```

These emit the `l:*` markers the client binds (`wireClick` → `l:click`, `wireModel` → `l:model`,
etc.). For any other attribute use `.attr(name, value)` (or `.attr(name)` for a boolean attribute):

```java
span(text(count)).attr("data-lievit-count", "");
```

Elements are immutable: `.attr(...)` returns a copy, so the same node can be reused safely.

## Escape by construction

Text and attribute values are escaped on render; there is no way to inject markup except the explicit
`raw(...)`. From the golden test (`lievit-dsl/src/test/.../HtmlGoldenTest.java`):

```java
// the counter tree renders to exact HTML with wire bindings
div(
    button(text("-")).wireClick("decrement"),
    span(text(3)).attr("data-lievit-count", ""),
    button(text("+")).wireClick("increment")
).render();
// "<div><button l:click=\"decrement\">-</button>
//   <span data-lievit-count=\"\">3</span>
//   <button l:click=\"increment\">+</button></div>"

// text content is escaped, scripts cannot break out
span(text("<script>alert('x')</script>")).render();
// "<span>&lt;script&gt;alert('x')&lt;/script&gt;</span>"

// attribute values cannot break out of the quotes
input().attr("value", "\"><img src=x onerror=alert(1)>").render();
// "<input value=\"&quot;&gt;&lt;img src=x onerror=alert(1)&gt;\">"
```

A `@Wire` value that happens to carry markup renders inert; the one escape hatch is `raw(...)`, which
is greppable in review.

## When to use which mode

| | Single-file (DSL) | Multi-file (JTE) |
|---|---|---|
| Markup lives in | the `@LievitRender Html` method | a separate `.jte` template |
| Checked by | the Java compiler | JTE's annotation processing |
| Best for | logic-heavy, colocated components | HTML-heavy, designer-authored markup |

Both ship from v0.1, both are type-safe; pick per component. JTE is the canonical primary engine, but
Thymeleaf, Mustache, FreeMarker, and raw are first-class adapters behind the same engine-agnostic
abstraction ([ADR-0004](../adr/0004-template-adapter-strategy.md)).

# Essential vs accidental complexity: lievit's positioning evidence

This is lievit's positioning IP, stated as engineering, not slogans. It is the catalog that backs
the claims in the README and the manifesto: where the established full-stack toolchains converge
(because they each solve a piece of the *essential* complexity of interactive apps) and where they
add *accidental* complexity (cost that comes from the tool, not the problem). lievit's case is that
the convergence is real and durable, and that the accidental parts are addressable without giving
up the essential ones.

## The distinction (Brooks)

Fred Brooks, *No Silver Bullet* (1986), splits software difficulty in two:

- **Essential complexity** is inherent in the problem. For an interactive web app: state has to
  live somewhere, the user's actions have to reach the server, the server's response has to update
  the screen, and the whole thing has to stay consistent and secure. You cannot remove this; you
  can only meet it.
- **Accidental complexity** comes from the tools and the way we happen to build, not from the
  problem. A JSON API you maintain only because your frontend and backend are separate codebases; a
  client-side state store that exists only because the framework put state on the client; a
  scaffolded folder that drifts from its template the first time you touch it. You *can* remove
  this, and removing it is most of what a good tool does.

Brooks' warning was that order-of-magnitude wins come from attacking accidental complexity (there
is no "silver bullet" for the essential kind). lievit is positioned exactly there: keep the
essential model of interactive apps, cut the accidental layers that the SPA-plus-REST era piled on.

## The essential model of an interactive app

Every interactive web framework has to answer the same four essential questions. This is the
*essential* column; no tool escapes it.

| Essential concern | What it means |
|---|---|
| **State** | Where the component's data lives between interactions, and how it survives a round trip. |
| **Transport** | How a user action reaches the server and how the result comes back. |
| **Rendering** | How state becomes markup the browser shows. |
| **Consistency + trust** | How the UI stays in sync with the truth, and how the server trusts what the client sends back. |

The toolchains below all answer these. They converge on the *shape* of the answer (server renders,
the wire carries the change, the DOM is morphed). Where they differ, and where the accidental cost
shows up, is in *how much extra machinery* each one demands to get there.

## The convergence: where the toolchains agree

The full-stack-over-the-wire family has converged on one answer to the essential model:

- **Render on the server, send HTML over the wire** (not JSON the client re-renders).
- **Morph the DOM** toward the new markup (Idiomorph or equivalent), rather than diffing a virtual
  DOM or replacing `innerHTML`.
- **Keep the developer in one language and one mental model**, not two codebases (server + SPA)
  with a contract between them.

| Tool | Host framework | The over-the-wire move | What it removed (accidental) |
|---|---|---|---|
| **Rails / Hotwire (Turbo)** | Rails | Turbo Streams / Frames, HTML over the wire | the JSON API + the SPA for most CRUD apps |
| **Laravel / Livewire** | Laravel | component state in the page, HTML responses | the JSON API + the client state store |
| **Phoenix / LiveView** | Elixir/Phoenix | diffs over a persistent WebSocket | the JSON API + the client state store |
| **lievit** | Spring Boot | HTML over a stateless signed wire | the JSON API + the client state store + the parallel frontend codebase |

This convergence is lievit's first proof-point: the move is not a fashion, it is four independent
ecosystems arriving at the same answer to the same essential problem. lievit brings that answer to
Spring, which lacks it.

The Java/Spring incumbents arrive at the essential model differently, and that difference is the
positioning gap:

- **JSF / PrimeFaces** answers it with *server-held view state* (the JSF view-state), which solves
  consistency but ties state to the server session and scales poorly. lievit answers the same
  concern with a *stateless signed snapshot*: same consistency, no sticky session.
- **Vaadin Flow** answers it with a *stateful server* and a rich component model. That solves the
  model but at the cost of a heavy server, a large client bundle, scaling that fights scale-to-zero,
  and a Pro paywall on parts of the catalog. lievit is the stateless inverse.

## The accidental complexity each toolchain adds

This is the *accidental* column: the cost that comes from the tool's own machinery, not from the
problem. These are lievit's content / manifesto proof-points, framed as engineering observations.

### Scaffold drift (the JHipster pattern)

The strongest single proof-point. JHipster generates a large, opinionated full-stack application
from a model. The generated code is excellent on day one. The accidental cost shows up later: the
generated code is *yours* to maintain, but it was written by a generator, and the moment you edit it
you have forked from the template. Regenerating overwrites your edits; not regenerating means the
scaffold and the generator drift apart. The widely reported lived experience is that a generated
project becomes **"unmanageable after 6 months"**: too much generated code to own, too coupled to
the generator to safely regenerate.

This is accidental, not essential: the *problem* never required thousands of lines of generated,
fork-on-first-edit code. The generator's convenience created the maintenance burden.

**How lievit addresses it without losing the convenience**: idempotent **region markers**
(`// lievit:region-start <id>` ... `// lievit:region-end <id>`). A generator (when one exists; the
heavy `make:*` scaffolder is deferred / AI-replaced) writes only inside its marked regions and a
single `IdempotentFileWriter` path (ArchUnit-enforced). Re-running it updates the regions and leaves
your code between them untouched. Deterministic output (explicit `ClockSource` / `RandomSource`)
plus `--dry-run` / `--force` means re-generation is safe and reviewable, not destructive. The
essential benefit (a generator gives you a correct starting point) is kept; the accidental cost
(drift, fork-on-edit, regenerate-or-rot) is designed out.

### The parallel frontend codebase (SPA + REST)

The dominant accidental layer of the last decade. To make a server app interactive, the SPA-plus-REST
pattern asks you to build and maintain:

- a **JSON API** whose only reason to exist is that the frontend is a separate program;
- a **client-side state store** (Redux/Pinia/signals) that re-derives, on the client, state the
  server already has;
- a **parallel frontend codebase** with its own build, its own routing, its own types, kept in sync
  with the backend by hand.

None of this is essential to "let the user click a button and see the result". It is accidental to
the choice of architecture. lievit removes all three: HTML over the wire means no JSON contract, the
server is the single owner of state so there is no client store, and the component is a Java class so
there is no parallel frontend codebase. (This is the README's "Spring without the layers".)

### Stateful-server lock-in (Vaadin Flow)

Vaadin Flow's component model is genuinely productive, and its base is loyal. The accidental cost is
structural: component state lives on the server, which forces a stateful server, which fights
scale-out and scale-to-zero and makes public-facing deployment heavy. The frontend is restrictive
(you work through the component abstraction, not raw HTML), and parts of the catalog (Pro Grid,
Charts) sit behind a paywall. The *essential* concern (consistency between UI and server truth) does
not require server-held state; lievit meets it with a signed stateless snapshot instead, which is why
it can scale out, scale to zero, and front public traffic.

### Server view-state (JSF)

JSF/PrimeFaces solves consistency with a server-held view-state and a complex lifecycle. The
accidental cost is the lifecycle's intricacy and the session-bound state, both of which the modern
over-the-wire answer avoids. lievit treats JSF as declining and explicitly *not* a migration target
(that is a services concern, not a tool concern).

### Sticky sessions for liveness (LiveView)

LiveView's persistent WebSocket gives the lowest latency, which is essential for true multiplayer.
But for the 95% case (business / internal / CRUD-interactive) the persistent connection is
accidental cost: it forces sticky sessions, which defeat scale-to-zero. lievit's stateless HTTP wire
is the explicit trade: slightly higher per-interaction latency in exchange for scale-out and
scale-to-zero. Low-latency multiplayer is a declared non-goal, so lievit does not pay LiveView's
accidental cost for a benefit its segment does not need.

### Per-keystroke request storms (the Livewire wound)

A small but concrete one. A naive `wire:model` that fires on every keystroke generates one request
per character, an accidental cost born of a default, not of the problem. lievit's `l:model` defaults
to a **500 ms debounce** (`.eager` to opt out, `.live` to opt in to per-keystroke). The essential
behavior (the field stays in sync) is preserved; the accidental traffic is removed by a better
default.

## The summary table (lievit's manifesto matrix)

| Tool | Essential model it gets right | Accidental complexity it adds | lievit's answer |
|---|---|---|---|
| **JHipster** | a correct full-stack starting point | generated code drifts; unmanageable after ~6 months | idempotent region markers + `IdempotentFileWriter`, regenerate safely |
| **SPA + REST** | rich interactivity | JSON API + client state store + parallel frontend codebase | HTML over the wire: none of the three |
| **Vaadin Flow** | a productive component model + consistency | stateful server, heavy bundle, scaling fight, Pro paywall | stateless signed snapshot, ~60-80 kb bundle, Apache 2.0 |
| **JSF / PrimeFaces** | UI-server consistency | server view-state + intricate lifecycle + session-bound | stateless wire, no view-state, no sticky session |
| **Phoenix LiveView** | lowest-latency liveness | persistent WebSocket -> sticky sessions -> no scale-to-zero | stateless HTTP wire (trades latency for scale-to-zero) |
| **Livewire** | HTML over the wire on the host framework | per-keystroke request storms by default; runtime (not compile-time) types | 500 ms debounce default; compile-time type-safety (JTE/DSL + records + ArchUnit) |
| **Hotwire / Turbo** | HTML over the wire, DOM morphing | Rails-bound; ERB runtime (untyped) | Spring-native; type-safe by construction |

## Why this is durable, not a fashion

The convergence column is four independent ecosystems answering the essential model the same way.
The accidental column is a list of costs each tool added for its own reasons, none of which is
intrinsic to interactive apps. lievit's bet is the Brooks bet: the order-of-magnitude win is in
removing the accidental layers (the JSON contract, the client store, the parallel codebase, the
scaffold drift, the stateful server, the per-keystroke storm) while keeping the essential model
intact. That is the proof-point behind "Spring without the layers", and it is engineering, not
marketing: every row above is a cost you can point at in a real codebase.

## Cross-references

- README.md — the positioning summary these proof-points back.
- ADR-0001 — the stateless wire (the LiveView trade, the scale-to-zero win).
- ADR-0004 — engine-agnostic adapters (adopt without rewriting the view layer).
- The entity's "Positioning / blue ocean" and "Winner differentiator" sections — the source
  material this document expands into engineering evidence.

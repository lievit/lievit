# Turbo backend contract (the #1 Spring gotcha)

lievit drives SPA navigation with **Turbo Drive** ([ADR-0085](../adr/0085-adopt-turbo-drive-for-navigation.md)).
Turbo upgrades every same-origin link and **every standard `<form method=post>`** to a fetch-and-swap,
no full page reload. That client win comes with a **server-side contract**, and the default Spring MVC
form idiom violates it silently. If you read one thing before shipping a form under lievit, read this.

> Verified against the official Turbo 8 handbook (2026-06-23):
> [Form Submissions](https://turbo.hotwired.dev/handbook/drive#redirecting-after-a-form-submission) ·
> [Streams](https://turbo.hotwired.dev/handbook/streams#streaming-from-http-responses).

## TL;DR

| Form outcome | Spring default | Turbo needs | Symptom if you get it wrong |
|---|---|---|---|
| **Success** | `return "redirect:/list"` → **302 Found** | **303 See Other** | 303 is the documented contract + correct PRG (forces GET) |
| **Validation error** | `return "form"` → **200 OK** | **422** (any 4xx/5xx) | **Errors never appear** — Turbo discards the 200 body and stays put |

The validation-error row is the trap. A 200-on-error looks correct in every server test and in a
JS-off browser, then ships, and under Turbo the re-rendered form with its error messages is thrown
away because Turbo will not render a 200 response to a POST.

## Why a 200 on a POST is discarded

The handbook is explicit:

> "After a stateful request from a form submission, Turbo Drive expects the server to return an HTTP
> 303 redirect response, which it will then follow and use to navigate and update the page without
> reloading."

> "The reason Turbo doesn't allow regular rendering on 200's from POST requests is that browsers have
> built-in behavior for dealing with reloads on POST visits … Turbo will stay on the current URL upon
> a form submission that tries to render, rather than change it to the form action."

And the exception that makes validation errors work:

> "The exception to this rule is when the response is rendered with either a 4xx or 5xx status code.
> This allows form validation errors to be rendered by having the server respond with `422
> Unprocessable Content`."

So: **success must redirect (303), errors must carry a 4xx/5xx status (422).** A 200 is the only
response Turbo refuses to render after a POST.

## The scope rule (read this before you "fix" anything)

The contract binds **only standard form navigations**. The lievit **wire is exempt**, and so is
lievit's SSE — do not touch them.

| Path | Turbo intercepts it? | Status rule |
|---|---|---|
| **Standard `<form method=post>`** (kit auth/resource forms JS-off; any MVC form that navigates) | **Yes** | 303 on success, 422 on validation error |
| **lievit wire** (`l:model` / `l:submit` / `l:click`) | **No** | Keep returning **200**; the redirect rides the effects channel (`effects.redirect`) |
| **lievit SSE** (`stream.ts` / `broadcast.ts` `EventSource`) | **No** | Not a navigation |

Why the wire is exempt: lievit's runtime drives a wire action with a **programmatic `fetch()`** to
`/lievit/*`, and Turbo only intercepts real `<a>` clicks and real `<form>` submits — it never sees a
`fetch` your code makes. The wire reply is the effects channel (JSON), and a wire "redirect" is an
`effects.redirect` the client honours. If you returned 303 from a wire endpoint you would break that
channel. **Never change a wire endpoint's status.**

A useful tell: if the control is bound with `l:model` / fired by `l:submit`, it commits over the wire
(exempt). If it is a bare `<form method=post>` that the browser submits (the JS-off / server-first
path), it is the navigation Turbo governs (contract applies).

## How to satisfy the contract in Spring MVC

### Success: force 303, not 302

Spring's `redirect:` prefix sends **302 Found** by default. Make it 303:

```java
// Option A — ResponseEntity, explicit and local
@PostMapping("/admin/products/create")
public ResponseEntity<Void> create(@RequestParam Map<String, String> params) {
    save(params);
    return ResponseEntity.status(HttpStatus.SEE_OTHER)   // 303
            .location(URI.create("/admin/products"))
            .build();
}
```

```java
// Option B — keep the view-name style, but stamp 303 globally for redirects
@Bean
WebMvcConfigurer turbo303() {
    return new WebMvcConfigurer() {
        @Override public void configureViewResolvers(ViewResolverRegistry registry) {
            UrlBasedViewResolver r = new UrlBasedViewResolver();
            r.setViewClass(RedirectView.class);
            r.setRedirectViewProvider(url -> {
                RedirectView v = new RedirectView(url);
                v.setStatusCode(HttpStatus.SEE_OTHER);     // 303 for every redirect: view
                return v;
            });
            registry.viewResolver(r);
        }
    };
}
```

### Validation error: re-render the form with status 422

Return the form view as usual, but set the status to 422 so Turbo renders it:

```java
@PostMapping("/admin/products/create")
public String create(@RequestParam Map<String, String> params, Model model,
                     HttpServletResponse response) {
    SaveResult<Product> result = form.save(params);
    if (result.ok()) {
        // success path → 303 (see above)
        ...
    }
    // validation error → re-render the form, but tell Turbo to render it
    response.setStatus(HttpStatus.UNPROCESSABLE_ENTITY.value());   // 422
    model.addAttribute("form", AdminFormView.of(form, ..., result.errors()));
    return "admin/form";
}
```

`@ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)` on a dedicated error path works too. Either way the
view still renders; only the status line changes, and that status line is what makes Turbo show the
errors instead of silently dropping them.

### Spring Security form login

Spring Security already **redirects** on both login success and login failure (302 to the target /
to `/login?error`), so it does not hit the 200-on-POST trap. It is Turbo-safe out of the box. If you
want strict 303 PRG parity you can supply custom success/failure handlers that send 303, but it is not
required for correctness.

## Turbo Streams vs lievit SSE (they don't collide)

Turbo Streams (the `text/vnd.turbo-stream.html` response Turbo will accept after a form POST and apply
as `<turbo-stream>` HTML actions) is **dormant in lievit**: lievit ships no `<turbo-stream>` markup
([ADR-0085 §2](../adr/0085-adopt-turbo-drive-for-navigation.md)), so the custom element registers but
never fires. lievit's own real-time channel is **SSE** — `stream.ts` (progressive `l:stream` output)
and `broadcast.ts` (server→client toasts/bell) — an `EventSource` over `/lievit/*` carrying lievit's
JSON envelopes (`{target, content, replace}` and `{name, detail, to}`), **not** Turbo's HTML-action
format.

They share only the `EventSource` **transport**; the **wire format** and the **element** are
different. Two consequences:

- You can adopt Turbo's `<turbo-stream-source src="…">` live-stream (an `EventSource` or `ws://`
  source emitting `<turbo-stream>` elements) in your own markup against your own
  `text/vnd.turbo-stream.html` endpoint. It is additive and never touches lievit's SSE.
- Do **not** answer a lievit **wire** POST with `text/vnd.turbo-stream.html`. The wire reply is the
  effects channel; Turbo doesn't intercept the wire request anyway, so the MIME negotiation is moot.

## Checklist before you ship a form

- [ ] Is it a bare `<form method=post>` that navigates? Then the contract applies.
- [ ] Success path returns **303** (not 302, not 200).
- [ ] Validation-error path returns **422** (not 200) and re-renders the form with the errors.
- [ ] Is it the lievit wire (`l:model`/`l:submit`)? Then leave it at **200** — exempt.
- [ ] A real-browser (Playwright) check that an invalid submit shows the errors in place, and a valid
      submit navigates (jsdom/happy-dom can't run Turbo's real interception — see ADR-0085).

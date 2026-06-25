# Forms and validation

lievit validates with Jakarta Bean Validation, server-authoritatively, on every wire call. There are
two layers: per-component field validation through the `FieldValidator` SPI, and **form objects**
that group related fields with co-located constraints.

## Real-time field validation

Annotate `@Wire` fields with any Jakarta constraint. lievit validates the component instance on every
wire call, after applying client updates and **before** running any action. If validation fails the
action is skipped and the per-field errors ride the effects channel.

```java
@LievitComponent(template = "registration")
public class RegistrationComponent {

    @Wire @NotBlank(message = "Email is required") @Email(message = "Must be a valid email address")
    String email = "";

    @Wire @NotBlank(message = "Name is required") @Size(min = 2, message = "Name must be at least 2 characters")
    String name = "";

    @Wire boolean submitted = false;   // @Wire so it round-trips in the snapshot

    @LievitAction
    void submit() { this.submitted = true; }   // skipped entirely while invalid
}
```

The template reads the reserved `_errors` model parameter (always a `Map<String, List<String>>`,
`null` when there are no errors):

```html
@param Map<String, List<String>> _errors = null

<input l:model.blur="email" name="email" value="${email}">
@if(_errors != null && _errors.containsKey("email"))
    @for(String msg : _errors.get("email"))
        <span class="error" data-field="email">${msg}</span>
    @endfor
@endif
```

On the client, the `l:error="email"` directive renders the first message for a field automatically
(see [directives](directives.md)). Debounce is a client concern (`l:model.blur`,
`l:model.debounce.300ms`); the server validates idempotently on every call.

### The `FieldValidator` SPI

Validation goes through one SPI (`dev.lievit.component.FieldValidator`): it receives the rehydrated,
updated component instance and returns `Map<fieldName, [messages]>`. An empty (or null) map means
valid; a non-empty map writes the `errors` effect and skips the action.

```java
public interface FieldValidator {
    Map<String, List<String>> validate(Object instance);
}
```

The Spring Boot starter auto-wires a `jakarta.validation.Validator`-backed implementation when
Hibernate Validator is on the classpath (add `spring-boot-starter-validation`). No annotation, no
`@Bean` required. Swap in your own bean to override (cross-field validation, async checks):

```java
@Bean
FieldValidator myValidator(MyService svc) {
    return instance -> svc.validate(instance);
}
```

The default `NoOpFieldValidator` passes everything, so omitting validation has zero cost.

## Form objects (ADR-0017)

A form object groups cohesive fields with their validation in one class and binds to a component via
a single `@Wire` field. It implements the marker interface `LievitFormObject`:

```java
public class RegisterForm implements LievitFormObject {

    @NotBlank(message = "Email is required") @Email(message = "Email must be valid")
    public String email = "";

    @NotBlank(message = "Password is required") @Size(min = 8, message = "Password must be at least 8 characters")
    public String password = "";

    public String confirm = "";   // no constraints: always passes
}

@LievitComponent(template = "register")
public class RegisterComponent {

    @Wire
    RegisterForm form = new RegisterForm();   // its fields round-trip nested in the snapshot

    @LievitAction
    public void submit() {
        FormValidationResult result = form.validate();
        if (result.hasErrors()) {
            return;   // surface result.violations() to the template
        }
        // form.email, form.password are valid and hydrated
    }
}
```

### How it crosses the wire

- Snapshot `wire`: the form object dehydrates to a nested map, e.g.
  `{"form": {"email": "x", "password": "y", "confirm": "z"}}`.
- Client `_updates`: use dotted paths, e.g. `{"form.email": "new@example.com"}`.

```java
// lievit-core test: FormObjectDispatcherTest — mount dehydrates the form object to a nested map
Map<String, Object> wire = dispatcher.mount(meta, new RegisterComponent()).wire();
// wire.get("form") -> { "email": "", "password": "" }
```

### Validating a form object

`LievitFormObject.validate()` runs Bean Validation on the form object's fields and returns a
`FormValidationResult`:

```java
// lievit-core test: FormValidationTest
RegisterForm form = new RegisterForm();
form.email = "alice@example.com";
form.password = "s3cur3pw";

FormValidationResult result = form.validate();
result.isValid();      // true
result.hasErrors();    // false
result.violations();   // empty map keyed by field name when valid
```

Bean Validation on a form object is **explicit**: it runs when you call `validate()` from an action,
not implicitly on the wire (unlike top-level `@Wire` field validation through the `FieldValidator`,
which is automatic). This keeps the form object's "when do I validate" decision in your action code.

### Security and bounds

The nested fields are subject to the same guards as top-level `@Wire` fields: the
[`PayloadGuard`](../adr/0013-payload-hardening.md) allowlist and depth caps apply to every value, and
a `@LievitProperty(locked = true)` form field rejects all dotted-path updates with `403`. Nesting is
bounded at exactly one level: a form object may not contain another form object. `LievitFormObject`
is a plain Java interface, not an annotation, so it does not count against the API surface cap.

## Testing validation

The `Lievit.test()` harness exposes `assertHasError(field, fragment)`, `assertNoErrors()`,
`assertNoErrors(field)`:

```java
@Test
void invalid_email_blocks_submit() {
    test(RegistrationComponent.class)
        .mount()
        .model("email", "not-an-email")
        .model("name", "Alice")
        .call("submit")
        .assertHasError("email", "valid email")   // message contains "valid email"
        .assertNoErrors("name");
}

@Test
void valid_form_submits() {
    test(RegistrationComponent.class)
        .mount()
        .model("email", "alice@example.com")
        .model("name", "Alice")
        .call("submit")
        .assertNoErrors()
        .assertWireMatches(comp -> comp.submitted);
}
```

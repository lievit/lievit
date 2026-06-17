/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit;

/**
 * Marker interface for form objects — cohesive field groups with co-located validation that bind
 * to a component via a single {@link Wire}-annotated field (ADR-0017, Livewire Form-object parity).
 *
 * <p>A class that implements {@code LievitFormObject} and is declared as a {@code @Wire} field on a
 * {@link LievitComponent} gains <em>nested wire binding</em>: its own fields round-trip through the
 * snapshot and the client {@code _updates} surface via dotted paths ({@code form.email},
 * {@code form.password}).
 *
 * <p>Example — a registration form object:
 *
 * <pre>{@code
 * public class RegisterForm implements LievitFormObject {
 *     public String email;
 *     public String password;
 *     public String confirm;
 * }
 *
 * @LievitComponent(template = "register")
 * public class RegisterComponent {
 *
 *     @Wire
 *     RegisterForm form = new RegisterForm();
 *
 *     @LievitAction
 *     public void submit() {
 *         // form.email, form.password, form.confirm are already hydrated
 *     }
 * }
 * }</pre>
 *
 * <p>Wire protocol:
 * <ul>
 *   <li>Snapshot {@code wire}: {@code {"form": {"email": "x", "password": "y", "confirm": "z"}}}.
 *   <li>Client {@code _updates}: uses dotted paths — {@code {"form.email": "new@example.com"}}.
 * </ul>
 *
 * <p>Security: the nested fields of a form object are subject to the same guards as top-level
 * {@code @Wire} fields. The nesting is bounded at exactly one level (form object → scalar/list/map
 * fields): a form object may not contain another form object. The {@link com.iambilotta.lievit.wire.PayloadGuard}
 * allowlist and depth caps apply to every value. No new annotation is introduced; the
 * seven-annotation cap of ADR-0002 is preserved.
 *
 * <p>Bean Validation ({@code jakarta.validation.constraints.*}) annotations on the form object's
 * fields are honored when {@link #validate()} is called from a {@link LievitAction} method; they
 * have no effect otherwise (the wire layer does not validate implicitly).
 *
 * <p>This interface is not one of the seven public annotations (ADR-0002) — it is a plain Java
 * interface and does not count against the cap.
 */
public interface LievitFormObject {

    /**
     * Validates the form object using Bean Validation (JSR-380). Returns a result object that
     * carries the violations, if any; it never throws on validation failure.
     *
     * <p>Example usage inside a {@link LievitAction}:
     *
     * <pre>{@code
     * @LievitAction
     * public void submit() {
     *     FormValidationResult result = form.validate();
     *     if (result.hasErrors()) {
     *         // handle violations — errors are keyed by field name
     *         return;
     *     }
     *     // proceed with clean data
     * }
     * }</pre>
     *
     * <p>The default implementation delegates to {@link FormValidator#validate(LievitFormObject)};
     * override it only if you need validation logic that Bean Validation cannot express.
     *
     * @return the validation result (never {@code null}; empty if valid)
     */
    default FormValidationResult validate() {
        return FormValidator.validate(this);
    }
}

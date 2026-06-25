/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitFormObject;
import dev.lievit.Wire;
import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;

/**
 * Specifies form-object binding: nested hydration from the snapshot, dotted-path updates via
 * {@code _updates}, dehydration back to a nested snapshot map, security guards (depth, allowlist,
 * non-form @Wire field isolation) (ADR-0017).
 */
class FormObjectDispatcherTest {

    private final WireDispatcher dispatcher = new WireDispatcher();

    // --- Fixtures -----------------------------------------------------------

    public static class RegisterForm implements LievitFormObject {
        public String email = "";
        public String password = "";
        public String confirm = "";
    }

    @LievitComponent(template = "register")
    static class RegisterComponent {
        @Wire
        RegisterForm form = new RegisterForm();

        String submitted = "no"; // non-@Wire: never reachable

        @LievitAction
        void submit() {
            this.submitted = "yes";
        }
    }

    // A component that also has a plain @Wire field alongside a form object.
    @LievitComponent(template = "login")
    static class LoginComponent {
        @Wire
        dev.lievit.component.FormObjectDispatcherTest.LoginForm form =
                new dev.lievit.component.FormObjectDispatcherTest.LoginForm();
        @Wire
        boolean rememberMe;

        @LievitAction
        void login() {}
    }

    public static class LoginForm implements LievitFormObject {
        public String username = "";
        public String password = "";
    }

    // --- Mount: initial state is dehydrated to a nested map -----------------

    /**
     * @spec.given a component with a @Wire LievitFormObject field and a fresh instance
     * @spec.when  the dispatcher mounts it
     * @spec.then  the snapshot wire carries the form object as a nested map ({"form": {"email":"", ...}})
     * @spec.adr   ADR-0017
     */
    @Test
    void mount_dehydrates_form_object_to_nested_map() {
        ComponentMetadata meta = ComponentMetadata.of(RegisterComponent.class);
        Map<String, Object> wire = dispatcher.mount(meta, new RegisterComponent()).wire();

        assertThat(wire).containsKey("form");
        @SuppressWarnings("unchecked")
        Map<String, Object> formMap = (Map<String, Object>) wire.get("form");
        assertThat(formMap).containsEntry("email", "").containsEntry("password", "").containsEntry("confirm", "");
    }

    // --- Hydration: snapshot nested map is written into form object fields --

    /**
     * @spec.given a snapshot wire carrying {"form": {"email": "alice@example.com", "password": "s3cr3t", "confirm": "s3cr3t"}}
     * @spec.when  the dispatcher rehydrates it (call with no updates, no actions)
     * @spec.then  the new snapshot wire has the same values: state survived the roundtrip
     * @spec.adr   ADR-0017
     */
    @Test
    void call_rehydrates_form_object_fields_from_nested_snapshot_map() {
        ComponentMetadata meta = ComponentMetadata.of(RegisterComponent.class);
        Map<String, Object> snapshotForm = Map.of(
                "email", "alice@example.com",
                "password", "s3cr3t",
                "confirm", "s3cr3t");
        Map<String, Object> snapshotWire = Map.of("form", snapshotForm);

        WireCall result = dispatcher.call(meta, new RegisterComponent(), snapshotWire, Map.of(), List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> outForm = (Map<String, Object>) result.wire().get("form");
        assertThat(outForm)
                .containsEntry("email", "alice@example.com")
                .containsEntry("password", "s3cr3t")
                .containsEntry("confirm", "s3cr3t");
    }

    // --- Dotted-path updates ------------------------------------------------

    /**
     * @spec.given a snapshot with form.email="" and an _updates entry {"form.email": "bob@example.com"}
     * @spec.when  the dispatcher applies the update
     * @spec.then  the new snapshot carries form.email = "bob@example.com": dotted-path update works
     * @spec.adr   ADR-0017
     */
    @Test
    void call_applies_dotted_path_update_to_form_object_field() {
        ComponentMetadata meta = ComponentMetadata.of(RegisterComponent.class);
        Map<String, Object> snapshotWire = Map.of("form",
                Map.of("email", "", "password", "", "confirm", ""));
        Map<String, Object> updates = Map.of("form.email", "bob@example.com");

        WireCall result = dispatcher.call(meta, new RegisterComponent(), snapshotWire, updates, List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> outForm = (Map<String, Object>) result.wire().get("form");
        assertThat(outForm).containsEntry("email", "bob@example.com");
        // The other form fields are unchanged.
        assertThat(outForm).containsEntry("password", "").containsEntry("confirm", "");
    }

    /**
     * @spec.given a snapshot with both a form object and a sibling @Wire boolean, and an _updates
     *     entry for each
     * @spec.when  the dispatcher applies the updates
     * @spec.then  both the dotted-path form update and the top-level boolean update are honored
     * @spec.adr   ADR-0017
     */
    @Test
    void call_applies_dotted_path_and_top_level_updates_together() {
        ComponentMetadata meta = ComponentMetadata.of(LoginComponent.class);
        Map<String, Object> snapshotWire = Map.of(
                "form", Map.of("username", "", "password", ""),
                "rememberMe", false);
        Map<String, Object> updates = Map.of(
                "form.username", "charlie",
                "rememberMe", true);

        WireCall result = dispatcher.call(meta, new LoginComponent(), snapshotWire, updates, List.of("login"));

        @SuppressWarnings("unchecked")
        Map<String, Object> outForm = (Map<String, Object>) result.wire().get("form");
        assertThat(outForm).containsEntry("username", "charlie");
        assertThat(result.wire()).containsEntry("rememberMe", true);
    }

    // --- Security: form-object field is accessible from action --------------

    /**
     * @spec.given a snapshot with form.email="alice@example.com", a dotted update for form.email, and
     *     the "submit" action
     * @spec.when  the dispatcher runs the call
     * @spec.then  the action can read the updated email (the form fields are on the real instance)
     * @spec.adr   ADR-0017
     */
    @Test
    void call_form_field_is_visible_to_action() {
        ComponentMetadata meta = ComponentMetadata.of(RegisterComponent.class);
        RegisterComponent instance = new RegisterComponent();
        Map<String, Object> snapshotWire = Map.of("form",
                Map.of("email", "old@example.com", "password", "", "confirm", ""));
        Map<String, Object> updates = Map.of("form.email", "new@example.com");

        dispatcher.call(meta, instance, snapshotWire, updates, List.of("submit"));

        // The action ran (submitted flag is set on the instance the action saw).
        assertThat(instance.submitted).isEqualTo("yes");
        // The form field update was applied before the action ran.
        assertThat(instance.form.email).isEqualTo("new@example.com");
    }

    // --- Security: out-of-allowlist paths are dropped -----------------------

    /**
     * @spec.given an _updates entry {"form.nonExistentField": "x"} that names a field not declared
     *     on the form object
     * @spec.when  the dispatcher applies the update
     * @spec.then  the update is silently dropped: only declared form fields are in the settable
     *     allowlist (ADR-0013 + ADR-0017). The call succeeds; no exception.
     * @spec.adr   ADR-0017
     */
    @Test
    void call_drops_update_to_undeclared_form_field() {
        ComponentMetadata meta = ComponentMetadata.of(RegisterComponent.class);
        Map<String, Object> snapshotWire = Map.of("form",
                Map.of("email", "", "password", "", "confirm", ""));
        Map<String, Object> updates = Map.of("form.nonExistentField", "injected");

        // Must not throw; the drop is silent (ADR-0013 policy).
        WireCall result = dispatcher.call(meta, new RegisterComponent(), snapshotWire, updates, List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> outForm = (Map<String, Object>) result.wire().get("form");
        // The declared fields are unaffected.
        assertThat(outForm).containsEntry("email", "").containsEntry("password", "").containsEntry("confirm", "");
    }

    /**
     * @spec.given an _updates entry with a three-segment path ("form.email.extra") — over the
     *     one-level depth bound
     * @spec.when  the dispatcher applies the update
     * @spec.then  the update is silently dropped: depth &gt; 1 is outside the settable allowlist
     *     (ADR-0017 §Security, the bounded-depth invariant). The call succeeds; no exception.
     * @spec.adr   ADR-0017
     */
    @Test
    void call_drops_update_with_over_deep_dotted_path() {
        ComponentMetadata meta = ComponentMetadata.of(RegisterComponent.class);
        Map<String, Object> snapshotWire = Map.of("form",
                Map.of("email", "safe@example.com", "password", "", "confirm", ""));
        Map<String, Object> updates = Map.of("form.email.extra", "injected");

        WireCall result = dispatcher.call(meta, new RegisterComponent(), snapshotWire, updates, List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> outForm = (Map<String, Object>) result.wire().get("form");
        assertThat(outForm).containsEntry("email", "safe@example.com"); // unchanged
    }

    /**
     * @spec.given an _updates entry with a dotted path whose left segment names a non-form @Wire
     *     field ("rememberMe.something")
     * @spec.when  the dispatcher applies the update
     * @spec.then  the update is silently dropped: the left side is not a form object
     * @spec.adr   ADR-0017
     */
    @Test
    void call_drops_dotted_path_update_to_non_form_object_wire_field() {
        ComponentMetadata meta = ComponentMetadata.of(LoginComponent.class);
        Map<String, Object> snapshotWire = Map.of(
                "form", Map.of("username", "", "password", ""),
                "rememberMe", false);
        Map<String, Object> updates = Map.of("rememberMe.something", "injected");

        WireCall result = dispatcher.call(meta, new LoginComponent(), snapshotWire, updates, List.of("login"));

        assertThat(result.wire()).containsEntry("rememberMe", false); // unchanged
    }

    /**
     * @spec.given an _updates entry with a dotted path whose left segment names a totally unknown
     *     field ("unknown.field")
     * @spec.when  the dispatcher applies the update
     * @spec.then  the update is silently dropped (the settable allowlist, ADR-0013)
     * @spec.adr   ADR-0013
     */
    @Test
    void call_drops_dotted_path_update_to_unknown_top_level() {
        ComponentMetadata meta = ComponentMetadata.of(RegisterComponent.class);
        Map<String, Object> snapshotWire = Map.of("form",
                Map.of("email", "", "password", "", "confirm", ""));
        Map<String, Object> updates = Map.of("unknown.field", "injected");

        // Must not throw.
        WireCall result = dispatcher.call(meta, new RegisterComponent(), snapshotWire, updates, List.of());

        assertThat(result.wire()).containsKey("form");
    }

    // --- Security: nested form objects are rejected at metadata build time --

    /**
     * @spec.given a LievitFormObject class whose field is itself a LievitFormObject (depth > 1)
     * @spec.when  FormObjectMetadata.of() is called on it
     * @spec.then  it throws IllegalArgumentException: nested form objects are not supported
     *     (bounded depth invariant, ADR-0017)
     * @spec.adr   ADR-0017
     */
    @Test
    void form_object_metadata_rejects_nested_form_objects() {
        assertThatThrownBy(() -> FormObjectMetadata.of(NestedFormObject.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nested form objects are not supported");
    }

    // A form object whose field is itself a LievitFormObject — forbidden.
    public static class InnerForm implements LievitFormObject {
        public String value = "";
    }

    public static class NestedFormObject implements LievitFormObject {
        public InnerForm inner = new InnerForm(); // illegal: depth > 1
        public String ok = "";
    }

    // --- Codec roundtrip: dehydrate → re-hydrate = identity ----------------

    /**
     * @spec.given a RegisterComponent with form fields set to known values
     * @spec.when  the wire state is read (dehydrate) and then fed back as a snapshot (rehydrate)
     * @spec.then  the re-hydrated form fields equal the original values: the nested map roundtrips
     *     without loss (ADR-0017 snapshot invariant)
     * @spec.adr   ADR-0017
     */
    @Test
    void form_object_wire_state_roundtrips_identity() {
        ComponentMetadata meta = ComponentMetadata.of(RegisterComponent.class);

        // Dehydrate: mount a component with known form state and read the wire map.
        RegisterComponent original = new RegisterComponent();
        original.form.email = "roundtrip@example.com";
        original.form.password = "hunter2";
        original.form.confirm = "hunter2";
        Map<String, Object> dehydrated = dispatcher.mount(meta, original).wire();

        // Rehydrate: feed the wire map back as a snapshot and read the new state.
        WireCall result = dispatcher.call(meta, new RegisterComponent(), dehydrated, Map.of(), List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> outForm = (Map<String, Object>) result.wire().get("form");
        assertThat(outForm)
                .containsEntry("email", "roundtrip@example.com")
                .containsEntry("password", "hunter2")
                .containsEntry("confirm", "hunter2");
    }

    // --- Locked top-level form field: rejected as expected ------------------

    /**
     * @spec.given a component whose @Wire form field is marked @LievitProperty(locked = true) and a
     *     client _updates entry with a dotted path targeting the locked field's sub-fields
     * @spec.when  the dispatcher applies the updates
     * @spec.then  it rejects with LOCKED_PROPERTY (403): the lock on the @Wire field propagates to
     *     any dotted-path update attempt (ADR-0001 amendment, ADR-0017)
     * @spec.adr   ADR-0017
     */
    @Test
    void call_rejects_dotted_path_update_to_locked_form_wire_field() {
        ComponentMetadata meta = ComponentMetadata.of(LockedFormComponent.class);
        Map<String, Object> snapshotWire = Map.of("form",
                Map.of("secret", "server-value"));
        Map<String, Object> updates = Map.of("form.secret", "attacker-value");

        assertThatThrownBy(
                () -> dispatcher.call(meta, new LockedFormComponent(), snapshotWire, updates, List.of()))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.LOCKED_PROPERTY);
    }

    public static class ServerOnlyForm implements LievitFormObject {
        public String secret = "server-value";
    }

    @LievitComponent
    static class LockedFormComponent {
        @Wire
        @dev.lievit.LievitProperty(locked = true)
        ServerOnlyForm form = new ServerOnlyForm();
    }

    // --- Typed form fields round-trip through the synthesizer registry (ADR-0020) ---------------

    enum Priority {
        LOW,
        HIGH
    }

    public static class TypedForm implements LievitFormObject {
        public LocalDate due = LocalDate.of(2026, 1, 1);
        public Priority priority = Priority.LOW;
        public BigDecimal amount = new BigDecimal("0.00");
    }

    @LievitComponent(template = "typed")
    static class TypedComponent {
        @Wire
        TypedForm form = new TypedForm();

        @LievitAction
        void noop() {}
    }

    /**
     * @spec.given a TypedComponent whose form holds a LocalDate, an enum, and a scaled BigDecimal
     * @spec.when  the wire state is dehydrated (mount) and fed straight back as a snapshot (rehydrate)
     * @spec.then  every typed sub-field reconstructs to its exact value: a form object is no longer
     *     String/primitive-only, it round-trips typed fields through the synthesizer registry
     *     (ADR-0020, the kit-CRUD blocker)
     * @spec.adr   ADR-0020
     */
    @Test
    void typed_form_fields_round_trip_through_dehydrate_and_rehydrate() {
        ComponentMetadata meta = ComponentMetadata.of(TypedComponent.class);
        TypedComponent original = new TypedComponent();
        original.form.due = LocalDate.of(2026, 6, 23);
        original.form.priority = Priority.HIGH;
        original.form.amount = new BigDecimal("19.90");

        Map<String, Object> dehydrated = dispatcher.mount(meta, original).wire();

        TypedComponent target = new TypedComponent();
        dispatcher.call(meta, target, dehydrated, Map.of(), List.of());

        assertThat(target.form.due).isEqualTo(LocalDate.of(2026, 6, 23));
        assertThat(target.form.priority).isEqualTo(Priority.HIGH);
        // Exact scale preserved (the BigDecimal-loses-scale bug is gone): "19.90", not 19.9.
        assertThat(target.form.amount).isEqualByComparingTo("19.90");
        assertThat(target.form.amount.scale()).isEqualTo(2);
    }

    /**
     * @spec.given a TypedComponent and a dotted-path update carrying raw wire:model strings for a
     *     date, an enum name, and a decimal
     * @spec.when  the dispatcher applies the updates
     * @spec.then  each raw string is coerced to the form field's declared type before binding (the
     *     LocalDate / enum / BigDecimal are set, not a String into a typed field): the update path
     *     reuses the same synthesizer golden path as a top-level @Wire field (ADR-0020)
     * @spec.adr   ADR-0020
     */
    @Test
    void dotted_path_update_coerces_raw_strings_to_the_typed_form_fields() {
        ComponentMetadata meta = ComponentMetadata.of(TypedComponent.class);
        TypedComponent instance = new TypedComponent();
        Map<String, Object> snapshotWire = dispatcher.mount(meta, new TypedComponent()).wire();
        Map<String, Object> updates = Map.of(
                "form.due", "2026-12-31",
                "form.priority", "HIGH",
                "form.amount", "42.50");

        dispatcher.call(meta, instance, snapshotWire, updates, List.of());

        assertThat(instance.form.due).isEqualTo(LocalDate.of(2026, 12, 31));
        assertThat(instance.form.priority).isEqualTo(Priority.HIGH);
        assertThat(instance.form.amount).isEqualByComparingTo("42.50");
        assertThat(instance.form.amount.scale()).isEqualTo(2);
    }

    /**
     * @spec.given a TypedComponent with typed form fields set to known values
     * @spec.when  the wire state is dehydrated to the snapshot
     * @spec.then  each typed sub-field is emitted as a @w tuple (not a bare value the codec would
     *     mangle), so it survives the JSON snapshot and rehydrates exactly (ADR-0020)
     * @spec.adr   ADR-0020
     */
    @Test
    void typed_form_fields_dehydrate_to_tuple_envelopes() {
        ComponentMetadata meta = ComponentMetadata.of(TypedComponent.class);
        TypedComponent original = new TypedComponent();
        original.form.amount = new BigDecimal("7.25");

        Map<String, Object> wire = dispatcher.mount(meta, original).wire();

        @SuppressWarnings("unchecked")
        Map<String, Object> formMap = (Map<String, Object>) wire.get("form");
        // A typed value dehydrates to a @w-tagged tuple map, never the bare typed object.
        assertThat(formMap.get("amount")).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> amountTuple = (Map<String, Object>) formMap.get("amount");
        assertThat(amountTuple).containsKey("@w");
    }
}

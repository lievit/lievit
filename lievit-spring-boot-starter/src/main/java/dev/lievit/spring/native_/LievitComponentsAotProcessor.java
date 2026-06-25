/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.native_;

import java.lang.reflect.Field;
import java.lang.reflect.RecordComponent;
import java.util.HashSet;
import java.util.Set;

import org.jspecify.annotations.Nullable;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.beans.factory.aot.BeanFactoryInitializationAotContribution;
import org.springframework.beans.factory.aot.BeanFactoryInitializationAotProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;

import dev.lievit.LievitComponent;
import dev.lievit.Wire;
import dev.lievit.wire.synth.Wireable;

/**
 * Registers the GraalVM native reflection metadata for every {@code @LievitComponent} discovered in
 * the application's bean factory at build time (ADR-0006). This is the per-application half of
 * lievit's reachability metadata; the static, component-independent half is {@link
 * LievitRuntimeHints}.
 *
 * <p><strong>Why this is necessary and cannot be auto-inferred.</strong> lievit drives the
 * component lifecycle by reflecting on each component class itself: {@code ComponentMetadata.of}
 * reads the {@code @Wire} <em>declared fields</em> and the {@code @LievitAction} /
 * {@code @LievitMount} / {@code @LievitRender} <em>declared methods</em>, calling {@code
 * setAccessible(true)} and invoking them by reflection on a fresh prototype instance per wire call.
 * Spring AOT infers hints for the framework's own reflective access (bean wiring, controller
 * binding) but has no way to know lievit will reflect over an arbitrary adopter class, so without
 * these hints the fields read back as their default and the actions are not found in a native image.
 *
 * <p>Registering the component type with {@link MemberCategory#DECLARED_FIELDS} +
 * {@link MemberCategory#INVOKE_DECLARED_METHODS} + {@link MemberCategory#INVOKE_DECLARED_CONSTRUCTORS}
 * makes exactly the surface {@code ComponentMetadata} touches reachable, and no more (closed-world,
 * ADR-0006): the declared {@code @Wire} fields lievit gets/sets, the declared lifecycle/action
 * methods it invokes, and the no-arg constructor Spring uses to mint the prototype.
 *
 * <p>It also registers the typed {@code @Wire} field state the synthesizer registry reconstructs
 * reflectively (ADR-0020): a record's canonical constructor, an enum's {@code valueOf}, a
 * {@link Wireable}'s {@code fromWire} factory, recursing through a record's components. Without these
 * a typed component round-trips on the JVM but not in a native image.
 *
 * <p>Implemented as a {@link BeanFactoryInitializationAotProcessor} rather than a static {@code
 * RuntimeHintsRegistrar} precisely because the set of components is the adopter's, not lievit's: the
 * processor reads the live bean factory at AOT time and contributes one hint per actual component.
 * It is registered in {@code META-INF/spring/aot.factories}.
 */
public final class LievitComponentsAotProcessor implements BeanFactoryInitializationAotProcessor {

    @Override
    public @Nullable BeanFactoryInitializationAotContribution processAheadOfTime(
            ConfigurableListableBeanFactory beanFactory) {
        String[] beanNames = beanFactory.getBeanNamesForAnnotation(LievitComponent.class);
        if (beanNames.length == 0) {
            return null;
        }
        return (generationContext, beanFactoryInitializationCode) -> {
            RuntimeHints hints = generationContext.getRuntimeHints();
            Set<Class<?>> seen = new HashSet<>();
            for (String beanName : beanNames) {
                Class<?> type = beanFactory.getType(beanName);
                if (type != null) {
                    registerComponent(hints, type);
                    // Register the typed @Wire field types (records / enums / Wireable VOs) the
                    // synthesizer registry reconstructs reflectively, so a typed component round-trips
                    // in a native image too (ADR-0020 + ADR-0006). Without this, a record @Wire field
                    // has no canonical-constructor metadata and fails to rehydrate natively.
                    for (Field field : type.getDeclaredFields()) {
                        if (field.isAnnotationPresent(Wire.class)) {
                            registerTypedState(hints, field.getType(), seen);
                        }
                    }
                }
            }
        };
    }

    private void registerComponent(RuntimeHints hints, Class<?> type) {
        hints.reflection()
                .registerType(
                        type,
                        MemberCategory.DECLARED_FIELDS,
                        MemberCategory.INVOKE_DECLARED_METHODS,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS);
    }

    /**
     * Registers the reflective surface the synthesizer registry touches for a typed {@code @Wire}
     * field value (ADR-0020): a {@code record}'s canonical constructor + accessors, an {@code enum}'s
     * {@code valueOf}, a {@link Wireable}'s {@code fromWire} factory, recursing through a record's
     * components so a nested typed value (a record holding a {@code List<EnumX>} or another record)
     * is reachable. JDK temporal / numeric synth targets need no per-app hint (the built-in synths
     * are registered statically). Cycle-safe via {@code seen}.
     */
    private void registerTypedState(RuntimeHints hints, Class<?> type, Set<Class<?>> seen) {
        if (type == null || type.isPrimitive() || !seen.add(type)) {
            return;
        }
        if (type.isEnum()) {
            hints.reflection().registerType(type, MemberCategory.INVOKE_DECLARED_METHODS);
            return;
        }
        if (Wireable.class.isAssignableFrom(type)) {
            hints.reflection()
                    .registerType(
                            type,
                            MemberCategory.INVOKE_DECLARED_METHODS,
                            MemberCategory.INVOKE_DECLARED_CONSTRUCTORS);
            return;
        }
        if (type.isRecord()) {
            hints.reflection()
                    .registerType(
                            type,
                            MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                            MemberCategory.INVOKE_DECLARED_METHODS);
            for (RecordComponent rc : type.getRecordComponents()) {
                registerTypedState(hints, rc.getType(), seen);
            }
        }
    }
}

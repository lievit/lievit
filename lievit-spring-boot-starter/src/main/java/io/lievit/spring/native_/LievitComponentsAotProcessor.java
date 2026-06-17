/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.native_;

import org.jspecify.annotations.Nullable;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.beans.factory.aot.BeanFactoryInitializationAotContribution;
import org.springframework.beans.factory.aot.BeanFactoryInitializationAotProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;

import io.lievit.LievitComponent;

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
            for (String beanName : beanNames) {
                Class<?> type = beanFactory.getType(beanName);
                if (type != null) {
                    registerComponent(hints, type);
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
}

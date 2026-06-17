/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.native_;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.aot.generate.DefaultGenerationContext;
import org.springframework.aot.generate.GenerationContext;
import org.springframework.aot.generate.InMemoryGeneratedFiles;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.predicate.RuntimeHintsPredicates;
import org.springframework.beans.factory.aot.BeanFactoryInitializationAotContribution;
import org.springframework.beans.factory.aot.BeanFactoryInitializationCode;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.beans.factory.support.RootBeanDefinition;

import com.iambilotta.lievit.spring.counter.CounterComponent;

/**
 * Drives {@link LievitComponentsAotProcessor} against a real bean factory and proves the AOT
 * pipeline contributes the reflection hints for the {@code @LievitComponent} beans it discovers
 * (ADR-0006). This is the build-time half of the native gate, tested without a full native compile:
 * a fake factory holds a {@link CounterComponent} bean definition, the processor runs, and the
 * resulting {@link org.springframework.aot.hint.RuntimeHints} carry the component's reflective
 * surface. CI still runs the actual {@code native:compile}; this keeps the fast loop honest.
 */
class LievitComponentsAotProcessorNfrTest {

    private final LievitComponentsAotProcessor processor = new LievitComponentsAotProcessor();

    /**
     * @spec.given a bean factory holding one @LievitComponent bean definition
     * @spec.when  the AOT processor runs and its contribution is applied to a generation context
     * @spec.then  the component's declared fields, methods, and constructors are registered for
     *     reflection, so a native image can drive its lifecycle exactly as the JVM does
     * @spec.adr   ADR-0006
     */
    @Test
    void contributes_reflection_hints_for_a_discovered_component() {
        DefaultListableBeanFactory beanFactory = new DefaultListableBeanFactory();
        beanFactory.registerBeanDefinition(
                "counterComponent", new RootBeanDefinition(CounterComponent.class));

        GenerationContext generationContext =
                new DefaultGenerationContext(
                        new org.springframework.aot.generate.ClassNameGenerator(
                                org.springframework.javapoet.ClassName.get(Object.class)),
                        new InMemoryGeneratedFiles());

        BeanFactoryInitializationAotContribution contribution =
                processor.processAheadOfTime(beanFactory);
        assertThat(contribution).isNotNull();
        contribution.applyTo(generationContext, NO_CODE);

        assertThat(
                        RuntimeHintsPredicates.reflection()
                                .onType(CounterComponent.class)
                                .withMemberCategory(MemberCategory.DECLARED_FIELDS))
                .accepts(generationContext.getRuntimeHints());
        assertThat(
                        RuntimeHintsPredicates.reflection()
                                .onType(CounterComponent.class)
                                .withMemberCategory(MemberCategory.INVOKE_DECLARED_METHODS))
                .accepts(generationContext.getRuntimeHints());
    }

    /**
     * @spec.given a bean factory with no @LievitComponent at all
     * @spec.when  the AOT processor runs
     * @spec.then  it contributes nothing (a null contribution), so an app that uses no lievit
     *     components pays no native metadata cost
     * @spec.adr   ADR-0006
     */
    @Test
    void contributes_nothing_when_there_are_no_components() {
        DefaultListableBeanFactory beanFactory = new DefaultListableBeanFactory();
        assertThat(processor.processAheadOfTime(beanFactory)).isNull();
    }

    /**
     * A no-op {@link BeanFactoryInitializationCode}: lievit's contribution only registers hints, it
     * generates no code, so the code sink is never used.
     */
    private static final BeanFactoryInitializationCode NO_CODE =
            new BeanFactoryInitializationCode() {
                @Override
                public org.springframework.javapoet.ClassName getClassName() {
                    throw new UnsupportedOperationException("not used by a hints-only contribution");
                }

                @Override
                public org.springframework.aot.generate.GeneratedMethods getMethods() {
                    throw new UnsupportedOperationException("not used by a hints-only contribution");
                }

                @Override
                public void addInitializer(
                        org.springframework.aot.generate.MethodReference methodReference) {
                    throw new UnsupportedOperationException("not used by a hints-only contribution");
                }
            };
}

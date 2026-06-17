/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;

import io.lievit.LievitComponent;
import io.lievit.component.BeanValidationFieldValidator;
import io.lievit.component.FieldValidator;
import io.lievit.component.NoOpFieldValidator;
import io.lievit.component.WireDispatcher;
import io.lievit.dsl.DslOrEngineTemplateAdapter;
import io.lievit.dsl.DslTemplateAdapter;
import io.lievit.jte.JteTemplateAdapter;
import io.lievit.render.TemplateAdapter;
import io.lievit.wire.ChecksumFailureLimiter;
import io.lievit.wire.ComponentId;
import io.lievit.wire.PayloadGuard;
import io.lievit.wire.SigningKeys;
import io.lievit.wire.SnapshotCodec;
import io.lievit.spring.native_.LievitRuntimeHints;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.resolve.ResourceCodeResolver;

/**
 * Wires the lievit runtime when the starter is on the classpath (ADR-0008): the codec (from {@code
 * lievit.signing-key}), the component registry (scanning {@code @LievitComponent} beans), the
 * dispatcher, the checksum-failure limiter, the JTE adapter (the canonical primary, ADR-0004), the
 * wire service, and the {@code POST /lievit/{id}/call} controller.
 *
 * <p>The web layer lives here, never in the codec (ADR-0007). Every bean is {@code
 * @ConditionalOnMissingBean}, so an application can override any piece (a custom adapter, a custom
 * codec, a custom field validator) without forking the starter.
 *
 * <p>Real-time validation: when {@code jakarta.validation.Validator} is available (i.e.
 * {@code spring-boot-starter-validation} / Hibernate Validator is on the classpath), a
 * {@link BeanValidationFieldValidator} bean is auto-configured and injected into the dispatcher.
 * Applications may declare their own {@link FieldValidator} bean to override it. Without Hibernate
 * Validator, the dispatcher uses {@link NoOpFieldValidator} and validation is a no-op.
 */
@AutoConfiguration
@ConditionalOnClass(WireDispatcher.class)
@EnableConfigurationProperties(LievitProperties.class)
@ImportRuntimeHints(LievitRuntimeHints.class)
public class LievitAutoConfiguration {

    /**
     * Builds the snapshot codec from the configured signing key(s).
     *
     * @param properties the bound {@code lievit.*} configuration
     * @return the codec
     */
    @Bean
    @ConditionalOnMissingBean
    public SnapshotCodec lievitSnapshotCodec(LievitProperties properties) {
        String current = properties.getSigningKey();
        if (current == null || current.isBlank()) {
            throw new IllegalStateException(
                    "lievit.signing-key is required (base64url, >= 32 bytes): a missing key is a"
                            + " startup failure, not a runtime surprise (wire-protocol §3)");
        }
        byte[] currentKey = decode(current);
        SigningKeys keys;
        if (properties.getSigningKeyPrev() != null && !properties.getSigningKeyPrev().isBlank()) {
            String prevKid = properties.getSigningKidPrev();
            keys =
                    SigningKeys.rotated(
                            properties.getSigningKid(),
                            currentKey,
                            prevKid == null ? "prev" : prevKid,
                            decode(properties.getSigningKeyPrev()));
        } else {
            keys = SigningKeys.of(properties.getSigningKid(), currentKey);
        }
        return new SnapshotCodec(keys, properties.getTtl());
    }

    /**
     * The structural-cap and deserialization-allowlist guard (ADR-0013), built from the configured
     * caps (defaults: 100 updates, 50 calls, depth 10).
     *
     * @param properties the bound {@code lievit.*} configuration
     * @return the payload guard
     */
    @Bean
    @ConditionalOnMissingBean
    public PayloadGuard lievitPayloadGuard(LievitProperties properties) {
        return new PayloadGuard(
                properties.getMaxUpdates(),
                properties.getMaxCalls(),
                properties.getMaxNestingDepth());
    }

    /**
     * The Jakarta Bean Validation-backed {@link FieldValidator}, in a nested configuration so the
     * outer class carries no {@code jakarta.validation.Validator} reference in any method signature.
     *
     * <p>This matters: Spring introspects the whole enclosing configuration class (every declared
     * method) while evaluating conditions on any one bean. If the outer class held a
     * {@code lievitFieldValidator(Validator)} method, an application that does not put
     * {@code jakarta.validation} on the classpath (a plain lievit app, e.g. {@code lievit-kit}) would
     * fail to introspect the class at all (CNFE on the absent parameter type), and the entire lievit
     * autoconfiguration would not load. Isolating the validator method behind
     * {@code @ConditionalOnClass(Validator.class)} on a nested class means the nested class is only
     * introspected when {@code jakarta.validation} is present; absent it, the dispatcher falls back
     * to {@link NoOpFieldValidator} and validation is a no-op.
     */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(jakarta.validation.Validator.class)
    public static class ValidationConfiguration {

        /**
         * @param validator the Jakarta Validator provided by Spring's {@code LocalValidatorFactoryBean}
         * @return the Bean Validation-backed field validator (overridable by the application)
         */
        @Bean
        @ConditionalOnMissingBean(FieldValidator.class)
        public FieldValidator lievitFieldValidator(jakarta.validation.Validator validator) {
            return new BeanValidationFieldValidator(validator);
        }
    }

    /**
     * @param payloadGuard the structural-cap / deserialization-allowlist guard (ADR-0013)
     * @param fieldValidator the field validator (Bean Validation-backed or custom); falls back to
     *     {@link NoOpFieldValidator} when no validator bean is available
     * @return the stateless lifecycle engine
     */
    @Bean
    @ConditionalOnMissingBean
    public WireDispatcher lievitWireDispatcher(
            PayloadGuard payloadGuard, ObjectProvider<FieldValidator> fieldValidator) {
        FieldValidator validator =
                fieldValidator.getIfAvailable(() -> NoOpFieldValidator.INSTANCE);
        return new WireDispatcher(payloadGuard, validator);
    }

    /**
     * @return the per-client checksum-failure budget (Livewire parity 10 / 600 s)
     */
    @Bean
    @ConditionalOnMissingBean
    public ChecksumFailureLimiter lievitChecksumFailureLimiter() {
        return new ChecksumFailureLimiter();
    }

    /**
     * @return the component id generator
     */
    @Bean
    @ConditionalOnMissingBean
    public ComponentId lievitComponentId() {
        return new ComponentId();
    }

    /**
     * Provides a JTE engine for the adapter if the host has not declared one. Resolves templates
     * from {@code classpath:jte/} as {@link ContentType#Html} (auto-escaping on).
     *
     * @return a classpath-resolving JTE engine
     */
    @Bean
    @ConditionalOnMissingBean
    public TemplateEngine lievitJteTemplateEngine() {
        return TemplateEngine.create(
                new ResourceCodeResolver("jte"), ContentType.Html);
    }

    /**
     * The active template adapter: a router (ADR-0018) that renders a single-file component (no
     * template, an {@code @LievitRender} returning {@code Html}) through the {@link
     * DslTemplateAdapter} and every other component through the JTE engine adapter (the canonical
     * primary, ADR-0004). Routing lives entirely behind the one {@link TemplateAdapter} SPI, so the
     * dispatcher, codec, registry, and HTTP edge are untouched by the second authoring mode.
     *
     * @param engine the JTE engine
     * @return the routing adapter
     */
    @Bean
    @ConditionalOnMissingBean
    public TemplateAdapter lievitTemplateAdapter(TemplateEngine engine) {
        return new DslOrEngineTemplateAdapter(
                new DslTemplateAdapter(), new JteTemplateAdapter(engine));
    }

    /**
     * Discovers every {@code @LievitComponent} bean and builds the registry.
     *
     * @param context the application context (source of bean definitions)
     * @param componentBeans the discovered component beans
     * @return the registry
     */
    @Bean
    @ConditionalOnMissingBean
    public ComponentRegistry lievitComponentRegistry(
            ApplicationContext context, ObjectProvider<Object> componentBeans) {
        Map<String, Class<?>> beanNamesToTypes = new HashMap<>();
        for (String beanName : context.getBeanNamesForAnnotation(LievitComponent.class)) {
            Class<?> type = context.getType(beanName);
            if (type != null) {
                beanNamesToTypes.put(beanName, type);
            }
        }
        return new ComponentRegistry(context, componentBeans, beanNamesToTypes);
    }

    /**
     * @param codec the codec
     * @param registry the registry
     * @param dispatcher the lifecycle engine
     * @param templateAdapter the active adapter
     * @param failureLimiter the failure budget
     * @param componentIds the id generator
     * @param json the mapper for the {@code Lievit-Effects} header bag (ADR-0012)
     * @return the wire-call orchestrator
     */
    @Bean
    @ConditionalOnMissingBean
    public LievitWireService lievitWireService(
            SnapshotCodec codec,
            ComponentRegistry registry,
            WireDispatcher dispatcher,
            TemplateAdapter templateAdapter,
            ChecksumFailureLimiter failureLimiter,
            ComponentId componentIds,
            tools.jackson.databind.ObjectMapper json,
            LievitProperties properties) {
        return new LievitWireService(
                codec,
                registry,
                dispatcher,
                templateAdapter,
                failureLimiter,
                componentIds,
                json,
                properties.getMaxNestingDepth());
    }

    /**
     * @param service the orchestrator
     * @return the wire endpoint controller
     */
    @Bean
    @ConditionalOnMissingBean
    public LievitWireController lievitWireController(LievitWireService service) {
        return new LievitWireController(service);
    }

    private static byte[] decode(String base64Url) {
        try {
            return Base64.getUrlDecoder().decode(base64Url);
        } catch (IllegalArgumentException e) {
            // Fall back to raw bytes so a plain (non-base64) dev key still works locally.
            return base64Url.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        }
    }
}

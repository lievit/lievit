/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

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

import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.component.WireDispatcher;
import com.iambilotta.lievit.jte.JteTemplateAdapter;
import com.iambilotta.lievit.render.TemplateAdapter;
import com.iambilotta.lievit.wire.ChecksumFailureLimiter;
import com.iambilotta.lievit.wire.ComponentId;
import com.iambilotta.lievit.wire.SigningKeys;
import com.iambilotta.lievit.wire.SnapshotCodec;

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
 * codec) without forking the starter.
 */
@AutoConfiguration
@ConditionalOnClass(WireDispatcher.class)
@EnableConfigurationProperties(LievitProperties.class)
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
     * @return the stateless lifecycle engine
     */
    @Bean
    @ConditionalOnMissingBean
    public WireDispatcher lievitWireDispatcher() {
        return new WireDispatcher();
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
     * The JTE template adapter (canonical primary, ADR-0004).
     *
     * @param engine the JTE engine
     * @return the adapter
     */
    @Bean
    @ConditionalOnMissingBean
    public TemplateAdapter lievitTemplateAdapter(TemplateEngine engine) {
        return new JteTemplateAdapter(engine);
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
            ComponentId componentIds) {
        return new LievitWireService(
                codec, registry, dispatcher, templateAdapter, failureLimiter, componentIds);
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

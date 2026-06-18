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
import io.lievit.component.LifecycleBus;
import io.lievit.component.LifecycleHooksListener;
import io.lievit.component.LifecyclePhase;
import io.lievit.component.LocaleListener;
import io.lievit.component.MagicActionListener;
import io.lievit.component.NoOpFieldValidator;
import io.lievit.component.RedirectListener;
import io.lievit.component.RenderlessListener;
import io.lievit.component.TransitionListener;
import io.lievit.component.SessionListener;
import io.lievit.compiler.DeterministicKeys;
import io.lievit.component.WireDispatcher;
import io.lievit.wire.synth.SynthesizerRegistry;
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
     * The typed-state synthesizer registry (ADR-0020): dehydrates a non-primitive {@code @Wire}
     * value (record / enum / date / money VO) to a tuple and hydrates it back to the exact type, so
     * a typed component survives the stateless round trip. An application registers custom synths by
     * declaring its own {@code SynthesizerRegistry} bean.
     *
     * @return the default synthesizer registry (built-in synth set + class-instantiation guard)
     */
    @Bean
    @ConditionalOnMissingBean
    public SynthesizerRegistry lievitSynthesizerRegistry() {
        return new SynthesizerRegistry();
    }

    /**
     * The lifecycle interceptor bus (ADR-0022) with lievit's built-in server-side runtime-parity
     * listeners registered (Epic #34, ADR-0030 / ADR-0031): the convention-named lifecycle hooks
     * (boot/booted, hydrate/dehydrate, updating/updated, rendering/rendered), the magic actions
     * ({@code $set} / {@code $toggle} / {@code $refresh} / ...), {@code @LievitRenderless}, the
     * server-driven redirect render-skip, and {@code @LievitSession} persistence.
     *
     * <p>Each listener no-ops for a component that does not use its feature, so the bus stays
     * behavior-neutral for a plain component (the Counter is unchanged). An application can replace
     * the whole bus by declaring its own {@code LifecycleBus} bean.
     *
     * @param synthesizers the typed-state registry the magic {@code $set} uses to coerce a value to
     *     the field type (ADR-0020)
     * @return the built-in lifecycle bus
     */
    @Bean
    @ConditionalOnMissingBean
    public LifecycleBus lievitLifecycleBus(SynthesizerRegistry synthesizers) {
        LifecycleBus bus = new LifecycleBus();
        // Registration order = trigger order within a phase: the user lifecycle hooks register
        // first so boot/hydrate/updating run before the framework listeners.
        LifecycleHooksListener.registerOn(bus);
        SessionListener.registerOn(bus);
        // Locale pinning (ADR-0037): capture the active locale into the snapshot memo on dehydrate,
        // restore it on hydrate before render, so a wire update keeps the component's pinned locale
        // instead of reverting to the fresh request default. No-ops when no LocaleSource is bound.
        LocaleListener.registerOn(bus);
        bus.on(LifecyclePhase.CALL, new MagicActionListener(synthesizers));
        // RenderlessListener owns the render-skip tally for both @LievitRenderless and the
        // @LievitJson RPC actions (#99): both return without re-rendering.
        RenderlessListener.registerOn(bus);
        RedirectListener.registerOn(bus);
        // @LievitTransition (#113): seed the transition effect on CALL before the action body runs,
        // so an imperative LievitEffects.current().transition(...) inside the action overrides it.
        TransitionListener.registerOn(bus);
        return bus;
    }

    /**
     * @param payloadGuard the structural-cap / deserialization-allowlist guard (ADR-0013)
     * @param fieldValidator the field validator (Bean Validation-backed or custom); falls back to
     *     {@link NoOpFieldValidator} when no validator bean is available
     * @param synthesizers the typed-state synthesizer registry (ADR-0020)
     * @param lifecycle the lifecycle interceptor bus (ADR-0022)
     * @return the stateless lifecycle engine, wired with the deterministic {@code @key} generator
     *     (ADR-0023) for keyless children
     */
    @Bean
    @ConditionalOnMissingBean
    public WireDispatcher lievitWireDispatcher(
            PayloadGuard payloadGuard,
            ObjectProvider<FieldValidator> fieldValidator,
            SynthesizerRegistry synthesizers,
            LifecycleBus lifecycle,
            ObjectProvider<io.lievit.component.ActionAuthorizer> actionAuthorizer) {
        FieldValidator validator =
                fieldValidator.getIfAvailable(() -> NoOpFieldValidator.INSTANCE);
        // The authorization seam (issue #57, ADR-0053): the Spring-Security-backed authorizer is
        // wired by LievitSecurityAutoConfiguration when spring-security is present; absent it, the
        // dispatcher falls back to permitAll (the permissive default keeps every existing test green).
        io.lievit.component.ActionAuthorizer authorizer =
                actionAuthorizer.getIfAvailable(io.lievit.component.ActionAuthorizer::permitAll);
        // Union of all dispatcher collaborators: the typed-state synthesizer registry (ADR-0020) and
        // the lifecycle interceptor bus (ADR-0022), plus the v4 compiler's deterministic-key generator
        // (lw-<crc32(template)>-<counter>, ADR-0023). The key generator gives a child declared without
        // an explicit @key a key stable for its template position across re-renders (the morph anchor
        // for keyed lists/tables).
        return WireDispatcher.builder()
                .payloadGuard(payloadGuard)
                .fieldValidator(validator)
                .synthesizers(synthesizers)
                .lifecycle(lifecycle)
                .keyGenerator(DeterministicKeys.GENERATOR)
                .actionAuthorizer(authorizer)
                .build();
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

    /**
     * The temp-path signer for file uploads (issue #159): reuses the lievit signing key so an upload
     * token is signed with the same secret as the snapshot (one key to manage).
     *
     * @param properties the bound {@code lievit.*} configuration
     * @return the signer
     */
    @Bean
    @ConditionalOnMissingBean
    public io.lievit.upload.TempFileSigner lievitTempFileSigner(LievitProperties properties) {
        String key = properties.getSigningKey();
        if (key == null || key.isBlank()) {
            throw new IllegalStateException("lievit.signing-key is required (also used to sign upload paths)");
        }
        return new io.lievit.upload.TempFileSigner(decode(key), properties.getUploadPreviewTtl());
    }

    /**
     * The filesystem temp storage for uploads (issue #159).
     *
     * @param properties the bound {@code lievit.*} configuration
     * @return the storage, rooted at {@code lievit.upload-temp-dir} or {@code ${tmp}/lievit-uploads}
     */
    @Bean
    @ConditionalOnMissingBean
    public io.lievit.spring.upload.TempFileStorage lievitUploadStorage(LievitProperties properties) {
        String dir = properties.getUploadTempDir();
        java.nio.file.Path root =
                dir != null && !dir.isBlank()
                        ? java.nio.file.Path.of(dir)
                        : java.nio.file.Path.of(System.getProperty("java.io.tmpdir"), "lievit-uploads");
        return new io.lievit.spring.upload.TempFileStorage(root);
    }

    /**
     * The upload controller (issue #159): {@code POST /lievit/upload} + the signed preview route.
     *
     * @param storage the temp storage
     * @param signer the temp-path signer
     * @param properties the bound configuration (max size)
     * @return the controller
     */
    @Bean
    @ConditionalOnMissingBean
    public io.lievit.spring.upload.LievitUploadController lievitUploadController(
            io.lievit.spring.upload.TempFileStorage storage,
            io.lievit.upload.TempFileSigner signer,
            LievitProperties properties) {
        io.lievit.upload.UploadConstraints constraints =
                new io.lievit.upload.UploadConstraints(properties.getUploadMaxBytes(), java.util.Set.of());
        return new io.lievit.spring.upload.LievitUploadController(storage, signer, constraints);
    }

    /**
     * The default local-filesystem {@link io.lievit.upload.FileStore} (issue #189): moves a validated
     * {@link io.lievit.upload.TemporaryUploadedFile} from the temp area to a permanent root. Conditional
     * on a missing bean, so an adopter wiring object storage (GCS / S3) replaces it ("ship a default,
     * adopter adapts").
     *
     * @param storage the temp storage holding the uploaded bytes
     * @param signer the temp-path signer (verifies a token before its bytes are moved)
     * @param properties the bound configuration (permanent root)
     * @return the local file store, rooted at {@code lievit.upload-store-dir} or {@code ${tmp}/lievit-files}
     */
    @Bean
    @ConditionalOnMissingBean(io.lievit.upload.FileStore.class)
    public io.lievit.upload.FileStore lievitFileStore(
            io.lievit.spring.upload.TempFileStorage storage,
            io.lievit.upload.TempFileSigner signer,
            LievitProperties properties) {
        String dir = properties.getUploadStoreDir();
        java.nio.file.Path root =
                dir != null && !dir.isBlank()
                        ? java.nio.file.Path.of(dir)
                        : java.nio.file.Path.of(System.getProperty("java.io.tmpdir"), "lievit-files");
        return new io.lievit.spring.upload.LocalFileStore(storage, signer, root);
    }

    /**
     * The temp-upload cleanup reaper (issue #191): deletes orphaned temp uploads (uploaded but never
     * stored) older than {@code lievit.upload-cleanup-max-age}. The bean self-schedules a fixed-rate
     * reap on its own daemon thread when {@code lievit.upload-cleanup-interval} is positive; a
     * non-positive interval leaves it idle (callable on demand). No dependency on Spring's
     * {@code @EnableScheduling}, so the reaper runs whether or not the app enabled scheduling.
     *
     * @param storage the temp storage to reap
     * @param properties the bound configuration (max age + interval)
     * @return the cleanup reaper (started)
     */
    @Bean(destroyMethod = "stop")
    @ConditionalOnMissingBean
    public io.lievit.spring.upload.TempUploadCleanup lievitUploadCleanup(
            io.lievit.spring.upload.TempFileStorage storage, LievitProperties properties) {
        io.lievit.spring.upload.TempUploadCleanup cleanup =
                new io.lievit.spring.upload.TempUploadCleanup(
                        storage, properties.getUploadCleanupMaxAge());
        cleanup.start(properties.getUploadCleanupInterval());
        return cleanup;
    }

    /**
     * The SSE broadcast channel (issue #304 / #45): the server→client live-push port. Opt-in, mounted
     * only when {@code lievit.broadcast.enabled=true} so an app that does not push live notifications
     * never holds an open SSE connection. The channel reuses the wire effects mapper to serialize the
     * event frame.
     *
     * @param json the mapper for the SSE event frame
     * @param properties the bound {@code lievit.*} configuration (the SSE timeout)
     * @return the SSE broadcast channel
     */
    @Bean
    @ConditionalOnMissingBean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
            prefix = "lievit.broadcast",
            name = "enabled",
            havingValue = "true")
    public io.lievit.spring.broadcast.SseBroadcastChannel lievitBroadcastChannel(
            tools.jackson.databind.ObjectMapper json, LievitProperties properties) {
        return new io.lievit.spring.broadcast.SseBroadcastChannel(
                json, properties.getBroadcast().getTimeout());
    }

    /**
     * The broadcast subscribe controller (issue #304 / #45): {@code GET /lievit/broadcast}, the SSE
     * stream a logged-in user's clients listen on. Mounted with the channel (same opt-in gate).
     *
     * @param channel the SSE broadcast channel
     * @return the broadcast controller
     */
    @Bean
    @ConditionalOnMissingBean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
            prefix = "lievit.broadcast",
            name = "enabled",
            havingValue = "true")
    public io.lievit.spring.broadcast.BroadcastController lievitBroadcastController(
            io.lievit.spring.broadcast.SseBroadcastChannel channel) {
        return new io.lievit.spring.broadcast.BroadcastController(channel);
    }

    /**
     * The default layout wrapper (issue #63/#181): wraps a full-page component in a minimal HTML5
     * document. A host that wants its own app shell declares its own {@link LayoutRenderer} bean.
     *
     * @return the default layout renderer
     */
    @Bean
    @ConditionalOnMissingBean
    public LayoutRenderer lievitLayoutRenderer() {
        return new DefaultLayoutRenderer();
    }

    /**
     * The runtime-asset injector (issue #121, ADR-0039): auto-injects lievit's runtime
     * {@code <script>} / {@code <style>} into full-page responses so a host app gets the client
     * runtime with no manual tags. Enabled by default; turn it off with
     * {@code lievit.assets.enabled=false} for an app that wires the runtime itself.
     *
     * @param properties the bound {@code lievit.*} config (asset URLs + flags)
     * @return the injector bean (only present when auto-injection is enabled)
     */
    @Bean
    @ConditionalOnMissingBean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
            prefix = "lievit.assets",
            name = "enabled",
            matchIfMissing = true)
    public LievitAssetInjector lievitAssetInjector(LievitProperties properties) {
        LievitProperties.Assets assets = properties.getAssets();
        return new LievitAssetInjector(assets.getScriptUrl(), assets.getStyleUrl(), "/lievit/update");
    }

    /**
     * The full-page renderer (issue #63/#181): mounts a route-target component, resolves its
     * {@code @LievitLayout}/{@code @LievitTitle}, and wraps it in the layout. When an
     * {@link LievitAssetInjector} bean is present (auto-injection enabled, issue #121), the renderer
     * injects the runtime assets into the page.
     *
     * @param service the wire orchestrator
     * @param layoutRenderer the layout wrapper
     * @param assetInjector the runtime-asset injector when enabled (absent when disabled)
     * @return the page renderer
     */
    @Bean
    @ConditionalOnMissingBean
    public LievitPageRenderer lievitPageRenderer(
            LievitWireService service,
            LayoutRenderer layoutRenderer,
            ObjectProvider<LievitAssetInjector> assetInjector) {
        return new LievitPageRenderer(service, layoutRenderer, assetInjector.getIfAvailable());
    }

    /**
     * Maps every {@code @LievitPage} component to a route on a single shared page handler (issue
     * #181, Livewire {@code Route::livewire} + {@code LivewirePageController} parity). The route's
     * path variables are bound to the component's same-named {@code @Wire} fields (props seeded before
     * mount), the lievit analogue of implicit route-model binding. Returns an empty router when no
     * {@code @LievitPage} component is present, so the bean is harmless in an app that routes its
     * full pages itself.
     *
     * @param context the application context (source of {@code @LievitPage} component beans)
     * @param renderer the full-page renderer
     * @return a router function mapping each {@code @LievitPage} route to the page handler
     */
    @Bean
    public org.springframework.web.servlet.function.RouterFunction<
                    org.springframework.web.servlet.function.ServerResponse>
            lievitPageRoutes(ApplicationContext context, LievitPageRenderer renderer) {
        return new LievitPageRoutes(context, renderer).build();
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

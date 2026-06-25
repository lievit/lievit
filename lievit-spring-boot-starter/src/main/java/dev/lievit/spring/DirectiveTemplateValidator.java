/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.util.StreamUtils;

import dev.lievit.compiler.DirectiveValidator;

/**
 * The fail-fast startup half of the unknown-{@code l:}-directive poka-yoke (ADR-0082): on context
 * refresh, scans the app's classpath templates ({@code classpath*:jte/**}{@code /*.jte} by default)
 * for {@code l:<name>} directives whose name is not a known lievit directive and throws, failing
 * startup before any request can hit the silently-broken markup.
 *
 * <p>This is the interim layer. The true compile-time poka-yoke (a Maven mojo / the CLI
 * {@code doctor} check, which runs the same {@link DirectiveValidator} on the source files) is the
 * follow-up; until it lands, failing at startup is strictly better than the client's silent
 * runtime no-op: it surfaces before traffic, with the template name and line, on every boot.
 *
 * <p>The validation logic itself is the Spring-free {@link DirectiveValidator} in
 * {@code lievit-compiler}; this class only feeds it the classpath template sources, so the future
 * compile-time pass reuses the exact same valid-directive set and error message.
 */
public final class DirectiveTemplateValidator implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(DirectiveTemplateValidator.class);

    private final String templateLocation;
    private final DirectiveValidator validator;
    private final ResourcePatternResolver resourceResolver;

    /**
     * @param templateLocation the Ant-style classpath pattern of templates to scan
     *     ({@code lievit.directives.template-location})
     * @param extraDirectives app-registered custom directive names to allowlist
     *     ({@code lievit.directives.extra})
     * @param resourceResolver the resolver used to enumerate the classpath templates
     */
    public DirectiveTemplateValidator(
            String templateLocation,
            List<String> extraDirectives,
            ResourcePatternResolver resourceResolver) {
        this.templateLocation = templateLocation;
        this.validator = new DirectiveValidator(Set.copyOf(extraDirectives));
        this.resourceResolver = resourceResolver;
    }

    /** Convenience for the autoconfiguration: resolves classpath resources via the default resolver. */
    public DirectiveTemplateValidator(String templateLocation, List<String> extraDirectives) {
        this(
                templateLocation,
                extraDirectives,
                new PathMatchingResourcePatternResolver(
                        DirectiveTemplateValidator.class.getClassLoader()));
    }

    /** Runs the scan at startup; throws {@link IllegalStateException} on the first unknown directive. */
    @Override
    public void afterPropertiesSet() {
        List<DirectiveValidator.Violation> violations = scan();
        if (violations.isEmpty()) {
            log.debug("lievit directive validation: no unknown l: directives in {}", templateLocation);
            return;
        }
        throw new IllegalStateException(formatFailure(violations));
    }

    /**
     * Scans every matched template and returns all unknown-directive violations (used by
     * {@link #afterPropertiesSet} and directly by tests).
     *
     * @return the violations across all scanned templates, in template + source order
     */
    public List<DirectiveValidator.Violation> scan() {
        List<DirectiveValidator.Violation> all = new ArrayList<>();
        Resource[] resources;
        try {
            resources = resourceResolver.getResources(templateLocation);
        } catch (IOException e) {
            // A non-resolvable location is not a violation: the app may not ship classpath JTE
            // templates (DSL-only, or a different engine). Skip rather than fail.
            log.debug("lievit directive validation: could not resolve {}: {}", templateLocation, e.getMessage());
            return all;
        }
        for (Resource resource : resources) {
            if (!resource.isReadable()) {
                continue;
            }
            String name = templateName(resource);
            all.addAll(validator.validate(name, read(resource)));
        }
        return all;
    }

    private static String read(Resource resource) {
        try {
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("failed reading template " + resource, e);
        }
    }

    /** A readable, repo-relative-ish template name for the error message (the path after {@code jte/}). */
    private static String templateName(Resource resource) {
        try {
            String url = resource.getURL().toString();
            int jte = url.lastIndexOf("/jte/");
            return jte >= 0 ? url.substring(jte + 1) : resource.getFilename();
        } catch (IOException e) {
            return resource.getFilename();
        }
    }

    /** Builds the multi-line, actionable failure message listing every unknown directive found. */
    private static String formatFailure(List<DirectiveValidator.Violation> violations) {
        Set<String> lines = new LinkedHashSet<>();
        for (DirectiveValidator.Violation v : violations) {
            lines.add("  - " + v.message());
        }
        return "lievit: "
                + violations.size()
                + " unknown l: directive(s) in templates (these would silently no-op in the browser):\n"
                + String.join("\n", lines)
                + "\nFix the template, or if a directive is registered at runtime via "
                + "runtime.directives.register, allowlist its name with "
                + "lievit.directives.extra=<name>. "
                + "To disable this check set lievit.directives.validate=false.";
    }
}

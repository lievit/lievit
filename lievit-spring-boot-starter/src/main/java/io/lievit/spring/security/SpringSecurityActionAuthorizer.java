/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.security;

import java.lang.reflect.AccessibleObject;
import java.lang.reflect.Method;

import org.aopalliance.intercept.MethodInvocation;
import org.jspecify.annotations.Nullable;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.security.access.expression.ExpressionUtils;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import io.lievit.LievitAuthorize;
import io.lievit.component.ActionAuthorizer;

/**
 * The Spring-Security-backed {@link ActionAuthorizer} (ADR-0053, issue #57): evaluates the
 * {@link LievitAuthorize} (and {@code @PreAuthorize}) SpEL on a {@code @LievitAction} against the
 * current {@link Authentication}, the canonical Spring Security way.
 *
 * <p>The evaluation reuses Spring Security's own {@link MethodSecurityExpressionHandler}: the same
 * expression parser, the same {@code MethodSecurityExpressionRoot} that backs {@code @PreAuthorize}
 * (so {@code hasRole(...)}, {@code hasAuthority(...)}, {@code isAuthenticated()},
 * {@code hasPermission(...)} all resolve identically), and the same {@code PermissionEvaluator} when
 * the host wired one onto the handler. This is the documented pattern for migrating an existing SpEL
 * authorization expression to the programmatic API (the WebSocket {@code MessageExpressionAuthorizationManager}
 * recipe in the reference): parse the string with {@code getExpressionParser().parseExpression(...)},
 * build the context with {@code createEvaluationContext(authentication, methodInvocation)}, and
 * {@code ExpressionUtils.evaluateAsBoolean(...)}.
 *
 * <p><strong>Permissive default (backward compatible).</strong> An action with NO
 * {@link LievitAuthorize} and no {@code @PreAuthorize} always passes: the seam only enforces where an
 * annotation is present. So adding this authorizer to the classpath changes nothing for the existing
 * components and their tests. Multiple {@link LievitAuthorize} on one method are AND-combined (all
 * must pass). {@code @PreAuthorize}, if also present, must pass too.
 *
 * <p>The SpEL root is Spring Security's {@code MethodSecurityExpressionRoot} (exactly as
 * {@code @PreAuthorize}); the component instance the action runs on is exposed as {@code #root.this},
 * so an expression may authorize against the component's own {@code @Wire} state, e.g.
 * {@code @LievitAuthorize("hasPermission(#root.this.invoice, 'update')")}. A {@code @LievitAction} is
 * invoked from the wire with no method arguments (its inputs are the rehydrated {@code @Wire}
 * fields), so the {@link ActionMethodInvocation} carries an empty argument array.
 */
public final class SpringSecurityActionAuthorizer implements ActionAuthorizer {

    private final MethodSecurityExpressionHandler expressionHandler;

    /**
     * @param expressionHandler Spring Security's method-security expression handler (the bean the
     *     starter builds with the host's {@code PermissionEvaluator} attached when present)
     */
    public SpringSecurityActionAuthorizer(MethodSecurityExpressionHandler expressionHandler) {
        this.expressionHandler = expressionHandler;
    }

    @Override
    public boolean authorize(Object component, Method action) {
        LievitAuthorize[] lievit = action.getAnnotationsByType(LievitAuthorize.class);
        String preAuthorize = preAuthorizeExpression(action);
        if (lievit.length == 0 && preAuthorize == null) {
            // No authorization annotation: permit (the backward-compatible permissive default).
            return true;
        }
        // Lazily resolve the authentication once; an anonymous request still has an Authentication
        // (the AnonymousAuthenticationFilter sets one inside the SecurityFilterChain). A null one
        // (no chain ran) means "no principal", which an authorization expression should deny.
        Authentication authentication = currentAuthentication();
        MethodInvocation invocation = new ActionMethodInvocation(component, action);
        // ALL @LievitAuthorize must pass (AND), then @PreAuthorize if present: deny-on-first-false.
        for (LievitAuthorize annotation : lievit) {
            if (!evaluate(annotation.value(), authentication, invocation)) {
                return false;
            }
        }
        return preAuthorize == null || evaluate(preAuthorize, authentication, invocation);
    }

    /**
     * Evaluates one SpEL authorization expression against the current authentication and the action's
     * target, reusing Spring Security's expression handler exactly as {@code @PreAuthorize} would.
     */
    private boolean evaluate(
            String expressionString, Authentication authentication, MethodInvocation invocation) {
        Expression expression =
                this.expressionHandler.getExpressionParser().parseExpression(expressionString);
        EvaluationContext context =
                this.expressionHandler.createEvaluationContext(() -> authentication, invocation);
        return ExpressionUtils.evaluateAsBoolean(expression, context);
    }

    private static Authentication currentAuthentication() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            // No filter chain populated a principal: treat as the anonymous-equivalent. Returning a
            // non-null sentinel keeps the expression handler's createEvaluationContext happy; the
            // expression itself (hasRole / isAuthenticated) then denies.
            return AnonymousSentinel.INSTANCE;
        }
        return authentication;
    }

    private static @Nullable String preAuthorizeExpression(Method action) {
        org.springframework.security.access.prepost.PreAuthorize pre =
                action.getAnnotation(org.springframework.security.access.prepost.PreAuthorize.class);
        return pre == null ? null : pre.value();
    }

    /**
     * A minimal {@link MethodInvocation} over the action's target + {@link Method}, the unit Spring
     * Security's {@code createEvaluationContext} needs to build the {@code MethodSecurityExpressionRoot}
     * ({@code getThis()} is the SpEL {@code #root} / {@code #this}). The action takes no wire-supplied
     * arguments, so {@code getArguments()} is empty; {@code proceed()} is never called (we only build
     * the evaluation context, never run the method through this).
     */
    private record ActionMethodInvocation(Object target, Method method) implements MethodInvocation {

        @Override
        public Method getMethod() {
            return method;
        }

        @Override
        public Object[] getArguments() {
            return new Object[0];
        }

        @Override
        public Object getThis() {
            return target;
        }

        @Override
        public AccessibleObject getStaticPart() {
            return method;
        }

        @Override
        public Object proceed() {
            throw new UnsupportedOperationException(
                    "authorization-only invocation: the action is run by the dispatcher, not here");
        }
    }

    /**
     * The non-null Authentication used when no SecurityContext principal is present (no chain ran):
     * unauthenticated, no authorities, so every {@code hasRole} / {@code isAuthenticated} denies.
     */
    private static final class AnonymousSentinel
            extends org.springframework.security.authentication.AbstractAuthenticationToken {
        private static final AnonymousSentinel INSTANCE = new AnonymousSentinel();

        private AnonymousSentinel() {
            super(java.util.List.of());
            setAuthenticated(false);
        }

        @Override
        public Object getCredentials() {
            return "";
        }

        @Override
        public Object getPrincipal() {
            return "anonymous";
        }
    }
}

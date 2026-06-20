/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import io.lievit.component.LievitEffects;

/**
 * Specifies the K3 URL-navigation action outcome (the Filament {@code Action::url()}): an action that
 * carries a {@link AdminAction#url url} navigates instead of mutating the domain, producing the
 * {@link AdminActionResult.Status#NAVIGATE} outcome and queuing the redirect effect. Authorization
 * still gates it. No Spring context needed.
 */
class UrlActionTest {

    record Listing(String id, String city) {}

    /**
     * @spec.given a UrlAction whose url mapper derives a detail path from the resolved record
     * @spec.when  it runs against a row id under a permit-all authorizer
     * @spec.then  the outcome is NAVIGATE to that path and the redirect rides the effects sink (no
     *     write happened)
     */
    @Test
    void a_url_action_navigates_to_the_records_detail_path() {
        UrlAction<Listing> action =
                UrlAction.make(
                        "open", "Open", record -> "/admin/listings/" + ((Listing) record).id());
        LievitEffects effects = LievitEffects.capturing();

        AdminActionResult result = run(action, "7", effects, AdminAuthorizer.permitAll());

        assertThat(result.isNavigation()).isTrue();
        assertThat(result.status()).isEqualTo(AdminActionResult.Status.NAVIGATE);
        assertThat(result.redirect()).isEqualTo("/admin/listings/7");
        assertThat(result.newTab()).isFalse();
        assertThat(effects.redirect()).isEqualTo("/admin/listings/7");
    }

    /**
     * @spec.given a UrlAction to a static URL opened in a new tab
     * @spec.when  it runs (no record needed)
     * @spec.then  the outcome is NAVIGATE to the static URL with newTab true
     */
    @Test
    void a_static_url_action_can_open_in_a_new_tab() {
        AdminAction<Listing> action =
                UrlAction.<Listing>make("docs", "Docs", "https://lievit.io").openUrlInNewTab();
        LievitEffects effects = LievitEffects.capturing();

        AdminActionResult result = run(action, null, effects, AdminAuthorizer.permitAll());

        assertThat(result.isNavigation()).isTrue();
        assertThat(result.redirect()).isEqualTo("https://lievit.io");
        assertThat(result.newTab()).isTrue();
    }

    /**
     * @spec.given any AdminAction (here the built-in ViewAction) given a url mapper
     * @spec.when  it runs
     * @spec.then  the url turns it into a navigation, overriding its own perform() (url() is a
     *     concern on every action, the Filament Action::url())
     */
    @Test
    void url_is_a_concern_on_every_action_not_only_url_action() {
        AdminAction<Listing> view =
                new ViewAction<Listing>().url(record -> "/admin/listings/" + ((Listing) record).id());
        LievitEffects effects = LievitEffects.capturing();

        AdminActionResult result = run(view, "3", effects, AdminAuthorizer.permitAll());

        assertThat(result.isNavigation()).isTrue();
        assertThat(result.redirect()).isEqualTo("/admin/listings/3");
    }

    /**
     * @spec.given a UrlAction and an authorizer that denies the operation
     * @spec.when  it runs
     * @spec.then  it is forbidden and no navigation effect is queued (the gate runs before the url)
     */
    @Test
    void a_url_action_is_gated_by_the_authorizer() {
        UrlAction<Listing> action =
                UrlAction.make("open", "Open", record -> "/admin/listings/" + ((Listing) record).id());
        LievitEffects effects = LievitEffects.capturing();

        AdminActionResult result = run(action, "7", effects, (op, res, rec) -> false);

        assertThat(result.status()).isEqualTo(AdminActionResult.Status.FORBIDDEN);
        assertThat(effects.redirect()).isNull();
    }

    private AdminActionResult run(
            AdminAction<Listing> action,
            @org.jspecify.annotations.Nullable String recordId,
            LievitEffects effects,
            AdminAuthorizer authorizer) {
        Resource<Listing> resource = resource();
        AdminActionContext<Listing> context =
                new AdminActionContext<>(
                        resource,
                        AdminRoutes.of("admin", resource),
                        authorizer,
                        effects,
                        recordId,
                        Map.of());
        return action.run(context);
    }

    static Resource<Listing> resource() {
        RecordRepository<Listing> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Listing> page(Query query) {
                        return Page.of(List.of(), 0);
                    }

                    @Override
                    public Optional<Listing> findById(String id) {
                        return Optional.of(new Listing(id, "Parma"));
                    }

                    @Override
                    public Listing create(Listing record) {
                        return record;
                    }

                    @Override
                    public Listing update(String id, Listing record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "listings";
            }

            @Override
            public String label() {
                return "Listings";
            }

            @Override
            public Table<Listing> table() {
                return Table.<Listing>create().id(Listing::id).column("City", Listing::city);
            }
        };
    }
}

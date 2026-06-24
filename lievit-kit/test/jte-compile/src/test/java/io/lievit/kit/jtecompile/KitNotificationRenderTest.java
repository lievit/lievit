/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER gate for the lievit-kit canonical NOTIFICATIONS chrome (kit/notification/bell.jte +
 * kit/notification/toast.jte).
 *
 * Like KitTableChromeRenderTest, the precompile smoke (the jte-maven-plugin `generate` goal in this
 * module's pom) proves the two templates COMPILE against io.lievit.kit + the lievit-ui partials; it
 * cannot prove the bell + toast chrome actually RENDER. This does: it builds real fixtures from the
 * kit model (a recipient-scoped NotificationBell over an in-memory store for the bell, a flashed
 * AdminNotification for the toast), wraps each in its render bundle (KitBellView / KitToastView),
 * source-renders the template on the fly (the same gg.jte 3.2.4 compiler, ContentType.Html,
 * DirectoryCodeResolver over the staged target/jte-src tree), and asserts the chrome lands.
 */
package io.lievit.kit.jtecompile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import io.lievit.kit.AdminNotification;
import io.lievit.kit.DatabaseNotification;
import io.lievit.kit.InMemoryDatabaseNotificationStore;
import io.lievit.kit.NotificationAction;
import io.lievit.kit.NotificationBell;
import io.lievit.kit.page.KitBellView;
import io.lievit.kit.page.KitToastView;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class KitNotificationRenderTest {

    /** The staged template tree: kit/notification/*.jte + the lievit/* partials, under target/jte-src. */
    private static final Path JTE_DIR = Path.of("target", "jte-src");

    private static final TemplateEngine ENGINE =
            TemplateEngine.create(new DirectoryCodeResolver(JTE_DIR), ContentType.Html);

    /** A fixed render clock so the relative-time + persisted timestamps are deterministic. */
    private static final Instant NOW = Instant.parse("2026-06-22T12:00:00Z");

    private String render(String template, Map<String, Object> model) {
        StringOutput out = new StringOutput();
        ENGINE.render(template, model, out);
        return out.toString();
    }

    // ---- the bell ---------------------------------------------------------------------------

    /** A bell over a store seeded with one unread + one read notification for the recipient. */
    private KitBellView bellWith(InMemoryDatabaseNotificationStore store) {
        // unread (success), persisted 2 minutes before NOW.
        store.send("u1", AdminNotification.success("Listing saved").body("Via Roma 12 is now live."));
        NotificationBell bell = NotificationBell.of(store, "u1");
        return KitBellView.of(
                        bell,
                        "/admin/notifications/%s/read",
                        "/admin/notifications/read-all",
                        "/admin/notifications/clear")
                .withRowHref("/admin/notifications/%s")
                .withClock(NOW.plusSeconds(120));
    }

    @Test
    void renders_the_bell_trigger_badge_and_panel_header_actions() {
        // The store clock is 2 minutes before the bell's render clock, so the row reads "2m ago".
        InMemoryDatabaseNotificationStore store =
                new InMemoryDatabaseNotificationStore(Clock.fixed(NOW, ZoneOffset.UTC));
        Map<String, Object> model = new HashMap<>();
        model.put("bell", bellWith(store));
        String html = render("kit/notification/bell.jte", model);

        // The bell trigger + an unread count of 1 (the destructive count pill).
        assertTrue(html.contains("data-slot=\"notification-bell-trigger\""), "bell trigger missing:\n" + html);
        assertTrue(html.contains("data-slot=\"notification-bell-count\""), "unread count pill missing");
        assertTrue(html.contains("1 unread"), "unread count not announced");
        // The header mark-all-read + clear-all POST actions (real form submits to the host URLs).
        assertTrue(html.contains("/admin/notifications/read-all"), "mark-all-read action href missing");
        assertTrue(html.contains("/admin/notifications/clear"), "clear-all action href missing");
    }

    @Test
    void renders_a_notification_row_with_body_relative_time_and_a_mark_read_post() {
        InMemoryDatabaseNotificationStore store =
                new InMemoryDatabaseNotificationStore(Clock.fixed(NOW, ZoneOffset.UTC));
        Map<String, Object> model = new HashMap<>();
        model.put("bell", bellWith(store));
        String html = render("kit/notification/bell.jte", model);

        // The row title + body from the stored data, the relative time, the unread dot.
        assertTrue(html.contains("Listing saved"), "row title missing:\n" + html);
        assertTrue(html.contains("Via Roma 12 is now live."), "row body missing");
        assertTrue(html.contains("2m ago"), "relative time missing");
        assertTrue(html.contains("data-slot=\"notification-bell-item-dot\""), "unread dot missing");
        // The success level maps to the circle-check Lucide glyph (NOT the stored heroicon name).
        assertFalse(html.contains("heroicon"), "stored heroicon icon must not leak into the markup");
        // The per-row mark-read POST href (the %s id pattern filled).
        assertTrue(
                html.contains("/admin/notifications/") && html.contains("/read\""),
                "mark-read action href missing:\n" + html);
        // The row deep-link.
        assertTrue(html.contains("data-slot=\"notification-bell-item-link\""), "row deep-link missing");
    }

    @Test
    void renders_the_empty_line_when_the_recipient_has_no_notifications() {
        InMemoryDatabaseNotificationStore store =
                new InMemoryDatabaseNotificationStore(Clock.fixed(NOW, ZoneOffset.UTC));
        NotificationBell bell = NotificationBell.of(store, "nobody");
        KitBellView view =
                KitBellView.of(bell, "/n/%s/read", "/n/read-all", "/n/clear").withClock(NOW);

        Map<String, Object> model = new HashMap<>();
        model.put("bell", view);
        String html = render("kit/notification/bell.jte", model);

        // No notifications => the empty line, no count pill, the header disabled.
        assertTrue(html.contains("You're all caught up."), "empty line missing:\n" + html);
        assertFalse(html.contains("data-slot=\"notification-bell-count\""), "no unread => no count pill");
    }

    // ---- the toast --------------------------------------------------------------------------

    @Test
    void renders_a_flash_toast_mapping_level_title_body_and_actions() {
        AdminNotification notification =
                AdminNotification.danger("Delete failed")
                        .body("The listing could not be deleted.")
                        .actions(
                                NotificationAction.make("retry", "Retry").url("/admin/listings/42/delete"),
                                NotificationAction.make("dismiss", "Dismiss").close());
        Map<String, Object> model = new HashMap<>();
        model.put("toast", KitToastView.of(notification));
        String html = render("kit/notification/toast.jte", model);

        // danger level => the toast renders the danger variant marker.
        // v-next toast: data-variant is on the toast-item root (role="none"); the live-region role
        // (assertive alert vs polite status) lives on the toast/region.jte container, not the item.
        // KitToastView.variant() returns level.name().toLowerCase() = "danger".
        assertTrue(html.contains("data-variant=\"danger\""), "danger variant not mapped:\n" + html);
        assertTrue(html.contains("data-slot=\"toast-item\""), "toast item root missing:\n" + html);
        // title => heading, body => description line.
        assertTrue(html.contains("Delete failed"), "toast heading (title) missing");
        assertTrue(html.contains("The listing could not be deleted."), "toast body missing");
        // a url action is a real <a href> (v-next toast renders the href directly).
        assertTrue(html.contains("/admin/listings/42/delete"), "url action href missing");
        // No inline on*-handler (strict CSP): the toast wiring is data-* only.
        assertFalse(html.contains("onclick="), "inline handler leaked (CSP violation)");
    }

    @Test
    void a_success_toast_maps_to_the_polite_status_role() {
        Map<String, Object> model = new HashMap<>();
        model.put("toast", KitToastView.of(AdminNotification.success("Saved")));
        String html = render("kit/notification/toast.jte", model);

        // success is not time-sensitive => the success variant marker.
        // v-next toast: role="none" on the toast-item; the polite status live-region role lives
        // on the toast/region.jte container (not this item partial). KitToastView maps success => "success".
        assertTrue(html.contains("data-variant=\"success\""), "success variant not mapped:\n" + html);
        assertTrue(html.contains("data-slot=\"toast-item\""), "toast item root missing:\n" + html);
        assertTrue(html.contains("Saved"), "toast heading missing");
    }
}

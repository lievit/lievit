/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER gate for the lievit-kit canonical ACTION affordance (kit/action.jte + kit/action/*).
 *
 * The precompile smoke (the jte-maven-plugin `generate` goal in this module's pom) proves the
 * templates COMPILE against io.lievit.kit + the lievit-ui partials; it cannot prove the action
 * pipeline actually RENDERS. This does: it builds real AdminAction / ActionGroup / DeleteAction /
 * UrlAction fixtures, source-renders kit/action.jte + kit/action/modal.jte + kit/action/group.jte
 * on the fly (the same gg.jte 3.2.4 compiler, ContentType.Html, DirectoryCodeResolver over the
 * staged target/jte-src tree), and asserts the affordance lands: url -> real <a href>; wire ->
 * l:click + the SAFE escaped row id; confirmed -> a native <dialog> invoker; modal -> the
 * ConfirmationModal / embedded form + Submit/Cancel; slide-over -> the sheet; the cluster -> the
 * button row + the '...' dropdown respecting ActionPlacement.
 */
package io.lievit.kit.jtecompile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import io.lievit.kit.AdminAction;
import io.lievit.kit.AdminActionContext;
import io.lievit.kit.AdminActionResult;
import io.lievit.kit.AdminOperation;
import io.lievit.kit.ActionGroup;
import io.lievit.kit.ActionPlacement;
import io.lievit.kit.ActionVariant;
import io.lievit.kit.ConfirmationModal;
import io.lievit.kit.DeleteAction;
import io.lievit.kit.ModalConfig;
import io.lievit.kit.UrlAction;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class KitActionRenderTest {

    /** The staged template tree: kit/action* + the lievit/* partials, under target/jte-src. */
    private static final Path JTE_DIR = Path.of("target", "jte-src");

    private static final TemplateEngine ENGINE =
            TemplateEngine.create(new DirectoryCodeResolver(JTE_DIR), ContentType.Html);

    /** A plain wire action (no url, no confirmation): runs server-side by name. */
    private static AdminAction<Object> wireAction(String name, String label) {
        return new AdminAction<>(name, label, AdminOperation.UPDATE) {
            @Override
            protected AdminActionResult perform(AdminActionContext<Object> context) {
                return AdminActionResult.completed(null);
            }
        };
    }

    private String render(String template, Map<String, Object> model) {
        StringOutput out = new StringOutput();
        ENGINE.render(template, model, out);
        return out.toString();
    }

    private Map<String, Object> model(String key, Object value, Object... rest) {
        Map<String, Object> m = new HashMap<>();
        m.put(key, value);
        for (int i = 0; i + 1 < rest.length; i += 2) {
            m.put((String) rest[i], rest[i + 1]);
        }
        return m;
    }

    @Test
    void a_url_action_renders_a_real_anchor_with_the_target_and_new_tab_rel() {
        UrlAction<Object> export =
                UrlAction.make("export", "Export", "/admin/cities/export");
        export.openUrlInNewTab().icon("download");
        String html = render("kit/action.jte", model("action", export));

        // 1. URL navigation: a real <a href> to the target, new-tab carries rel=noopener.
        assertTrue(html.contains("href=\"/admin/cities/export\""), "url-action href missing:\n" + html);
        assertTrue(html.contains("Export"), "url-action label missing");
        assertTrue(html.contains("target=\"_blank\""), "new-tab target missing");
        assertTrue(html.contains("noopener"), "new-tab rel=noopener missing");
        assertTrue(html.contains("data-kit-action=\"export\""), "action marker missing");
    }

    @Test
    void a_wire_action_renders_an_l_click_carrying_the_row_id_safely() {
        AdminAction<Object> run = wireAction("recalculate", "Recalculate");
        String html = render("kit/action.jte", model("action", run, "recordId", "42"));

        // 3. Plain wire action: l:click="<name>" + the SAFE per-row id as an escaped data-id.
        assertTrue(html.contains("l:click=\"recalculate\""), "wire l:click missing:\n" + html);
        assertTrue(html.contains("data-id=\"42\""), "per-row id arg missing (the SAFE wireArgs channel)");
        assertTrue(html.contains("Recalculate"), "wire-action label missing");
        // It is NOT an anchor (no url navigation).
        assertFalse(html.contains("href=\"/"), "a wire action must not render a navigation href");
    }

    @Test
    void a_confirmed_action_renders_a_native_dialog_invoker_not_an_immediate_run() {
        DeleteAction<Object> del = new DeleteAction<>();
        String html =
                render("kit/action.jte", model("action", del, "recordId", "7", "modalId", "del-7"));

        // 2. Confirmed action: a native <dialog> invoker (command/commandfor), no immediate l:click.
        assertTrue(html.contains("command=\"show-modal\""), "dialog invoker command missing:\n" + html);
        assertTrue(html.contains("commandfor=\"del-7\""), "dialog invoker target id missing");
        assertTrue(html.contains("data-kit-action-confirm=\"true\""), "confirm marker missing");
        assertTrue(html.contains("Delete"), "delete label missing");
        // The confirm trigger must NOT fire the action directly (that is the modal's Submit).
        assertFalse(html.contains("l:click=\"delete\""), "confirm trigger must not run the action itself");
    }

    @Test
    void the_action_modal_renders_the_confirmation_and_a_submit_cancel_footer() {
        DeleteAction<Object> del = new DeleteAction<>();
        String html =
                render(
                        "kit/action/modal.jte",
                        model("action", del, "modalId", "del-7", "recordId", "7"));

        // The native <dialog> shell + the ConfirmationModal heading/description.
        assertTrue(html.contains("<dialog"), "modal <dialog> shell missing:\n" + html);
        assertTrue(html.contains("id=\"del-7\""), "modal id missing");
        assertTrue(html.contains("Are you sure?"), "confirmation heading missing");
        assertTrue(html.contains("This cannot be undone."), "destructive confirmation description missing");
        // The footer: Cancel (native dialog close) + the Submit that FIRES the action with the row id.
        assertTrue(html.contains("Cancel"), "cancel label missing");
        assertTrue(html.contains("Confirm"), "confirm/submit label missing");
        assertTrue(html.contains("l:click=\"delete\""), "submit must fire the delete action:\n" + html);
        assertTrue(html.contains("data-id=\"7\""), "submit must carry the SAFE row id");
    }

    @Test
    void the_action_modal_can_slide_over_and_host_an_embedded_form_body() {
        AdminAction<Object> assign = wireAction("assign", "Assign");
        ModalConfig cfg =
                ModalConfig.defaults().heading("Assign agent").width("lg").asSlideOver();
        Map<String, Object> m = new HashMap<>();
        m.put("action", assign);
        m.put("modal", cfg);
        m.put("modalId", "assign-9");
        m.put("recordId", "9");
        // An embedded form body (the FormAction case): the host server-renders the fields.
        StringOutput out = new StringOutput();
        gg.jte.Content body =
                new gg.jte.Content() {
                    @Override
                    public void writeTo(gg.jte.TemplateOutput output) {
                        output.writeContent(
                                "<form id=\"assign-form\"><label>Agent</label>"
                                        + "<input name=\"agent\"></form>");
                    }
                };
        m.put("body", body);
        String html = render("kit/action/modal.jte", m);

        // Slide-over shell (the sheet partial) + the heading + the embedded form fields.
        assertTrue(html.contains("data-side="), "slide-over (sheet) shell missing:\n" + html);
        assertTrue(html.contains("Assign agent"), "modal heading missing");
        assertTrue(html.contains("id=\"assign-form\""), "embedded form body missing");
        assertTrue(html.contains("name=\"agent\""), "embedded form field missing");
        assertTrue(html.contains("l:click=\"assign\""), "submit must fire the assign action");
    }

    @Test
    void the_action_modal_overrides_with_a_custom_confirmation_record() {
        AdminAction<Object> archive = wireAction("archive", "Archive");
        ConfirmationModal cm =
                new ConfirmationModal(
                        "Archive this city?",
                        "It moves out of the active list.",
                        "Archive it",
                        "Keep",
                        "archive");
        String html =
                render(
                        "kit/action/modal.jte",
                        model("action", archive, "confirm", cm, "modalId", "arch-3", "recordId", "3"));

        assertTrue(html.contains("Archive this city?"), "custom heading missing:\n" + html);
        assertTrue(html.contains("It moves out of the active list."), "custom description missing");
        assertTrue(html.contains("Archive it"), "custom submit label missing");
        assertTrue(html.contains("Keep"), "custom cancel label missing");
    }

    @Test
    void a_header_cluster_renders_the_actions_in_a_right_aligned_row() {
        UrlAction<Object> create =
                UrlAction.make("create", "New", "/admin/cities/create");
        create.color("primary");
        UrlAction<Object> export =
                UrlAction.make("export", "Export", "/admin/cities/export");
        String html =
                render(
                        "kit/action/group.jte",
                        model(
                                "actions",
                                List.of(create, export),
                                "placement",
                                ActionPlacement.HEADER));

        assertTrue(html.contains("data-action-placement=\"HEADER\""), "header placement marker missing:\n" + html);
        assertTrue(html.contains("justify-end"), "header cluster must be right-aligned");
        assertTrue(html.contains("/admin/cities/create"), "create action missing from cluster");
        assertTrue(html.contains("/admin/cities/export"), "export action missing from cluster");
    }

    @Test
    void a_row_cluster_folds_an_action_group_into_a_dropdown_menu() {
        AdminAction<Object> edit = wireAction("edit", "Edit");
        edit.variant(ActionVariant.LINK);
        AdminAction<Object> replicate = wireAction("replicate", "Replicate");
        DeleteAction<Object> del = new DeleteAction<>();
        ActionGroup<Object> group = ActionGroup.make(replicate, del);

        String html =
                render(
                        "kit/action/group.jte",
                        model(
                                "actions",
                                List.of(edit),
                                "group",
                                group,
                                "placement",
                                ActionPlacement.ROW,
                                "recordId",
                                "5"));

        // The flat Edit action renders inline; the group folds into a '...' dropdown-menu.
        assertTrue(html.contains("data-action-placement=\"ROW\""), "row placement marker missing:\n" + html);
        assertTrue(html.contains("Edit"), "flat row action missing");
        assertTrue(html.contains("popovertarget="), "dropdown-menu trigger (the '...' menu) missing");
        assertTrue(html.contains("data-kit-action-menuitem=\"replicate\""), "grouped Replicate menuitem missing");
        assertTrue(html.contains("data-kit-action-menuitem=\"delete\""), "grouped Delete menuitem missing");
        // The grouped Delete is still a confirmed action: it opens its modal, per-row id-scoped.
        assertTrue(html.contains("command=\"show-modal\""), "grouped confirmed action must keep its dialog invoker");
    }

    @Test
    void a_hidden_action_does_not_render_in_the_cluster() {
        AdminAction<Object> edit = wireAction("edit", "Edit");
        AdminAction<Object> secret = wireAction("secret", "Secret");
        secret.hidden(r -> true);
        String html =
                render(
                        "kit/action/group.jte",
                        model("actions", List.of(edit, secret), "placement", ActionPlacement.ROW));

        assertTrue(html.contains("Edit"), "visible action missing:\n" + html);
        assertFalse(html.contains(">Secret<"), "a hidden action must not render");
    }
}

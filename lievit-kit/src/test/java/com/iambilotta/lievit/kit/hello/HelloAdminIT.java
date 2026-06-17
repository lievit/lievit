/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import com.iambilotta.lievit.spring.LievitWireService;
import com.iambilotta.lievit.spring.WireCallResult;

/**
 * The hello-admin end-to-end tracer-bullet (ADR-0008): a single {@link
 * com.iambilotta.lievit.kit.Resource} listing rows is mounted through the real lievit runtime
 * (codec + registry + dispatcher + JTE adapter) and renders an HTML table whose rows came through
 * the persistence-agnostic {@link com.iambilotta.lievit.kit.RecordRepository} port.
 *
 * <p>This is the minimal "hello-admin" the skeleton exists to prove: a Resource -&gt; its data port
 * -&gt; an HTML list, rendered via lievit-jte on the lievit runtime, proving the wiring end-to-end.
 * It boots a Spring context, so it is an {@code *IT} (the failsafe loop of ADR-0007).
 */
@SpringBootTest(classes = HelloAdminTestApp.class)
@TestPropertySource(
        properties = {
            // A >= 32-byte dev signing key (the codec floor), as in the runtime's CounterRoundtripIT.
            "lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"
        })
class HelloAdminIT {

    @Autowired LievitWireService wireService;

    /**
     * @spec.given the hello-admin ListingResource wired with an in-memory repository of two rows
     * @spec.when  its list component is mounted through the wire service and rendered by JTE
     * @spec.then  the response is an HTML table with the column headers and one row per record,
     *     carrying the values the repository served, plus a signed snapshot
     * @spec.adr   ADR-0008
     */
    @Test
    void renders_the_resource_list_through_the_runtime() {
        WireCallResult mounted = wireService.mount(ListingAdminListComponent.class.getName());

        String html = mounted.html();
        assertThat(html)
                .contains("data-admin-list")
                .contains("<h1 data-admin-heading>Listings</h1>")
                .contains("<th>Ref</th>")
                .contains("<th>City</th>")
                .contains("data-admin-row=\"1\"")
                .contains("<td>Parma</td>")
                .contains("data-admin-row=\"2\"")
                .contains("<td>Reggio Emilia</td>");
        assertThat(mounted.snapshot()).isNotBlank();
    }
}

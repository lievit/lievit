@param io.lievit.kit.hello.Listing row
<%-- NEGATIVE FIXTURE (ADR-0082): the pre-fix hello-admin row-arm that shipped silently broken.
     l:value is not a lievit directive and l:model binds an INPUT listener a <button> never fires,
     so this armed nothing in the browser while the server ITs passed. The validator MUST reject it.
     The fixed form is the $set magic action in listing-list.jte. --%>
<div data-lievit-component>
    <button l:model="x" l:value="${row.ref()}" l:click="arm">Delete</button>
</div>

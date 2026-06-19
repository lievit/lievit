@import io.lievit.component.ComponentMetadata
@import io.lievit.kit.AdminListView
@import io.lievit.kit.Cell
@import io.lievit.kit.hello.ListingListComponent
@param ListingListComponent _instance
@param String createUrl
@param int page
@param String pendingDeleteId
@param ComponentMetadata _component
!{AdminListView view = _instance.view();}
<div data-lievit-component="${_component.className()}" data-admin-list>
    <h1 data-admin-heading>${view.heading()}</h1>
    <a data-admin-create href="${createUrl}">New</a>
    <table>
        <thead>
        <tr>
            @for(String header : view.headers())
                <th>${header}</th>
            @endfor
            <th>Actions</th>
        </tr>
        </thead>
        <tbody>
        @for(AdminListView.Row row : view.rows())
            <tr data-admin-row="${row.id()}">
                @for(Cell cell : row.cells())
                    @if(cell instanceof Cell.Badge badge)
                        <td><lv-badge variant="${badge.variant()}">${badge.text()}</lv-badge></td>
                    @elseif(cell instanceof Cell.Link link)
                        @if(link.newTab())
                            <td><a href="${link.href()}" target="_blank" rel="noopener noreferrer">${link.text()}</a></td>
                        @else
                            <td><a href="${link.href()}">${link.text()}</a></td>
                        @endif
                    @elseif(cell instanceof Cell.Icon icon)
                        <td><lv-icon name="${icon.name()}" data-color="${icon.color()}"></lv-icon>@if(!icon.text().isEmpty())<span>${icon.text()}</span>@endif</td>
                    @else
                        <td>${cell.text()}</td>
                    @endif
                @endfor
                <td>
                    @if(pendingDeleteId.equals(row.id()))
                        <span data-admin-confirm="${row.id()}">Delete ${row.id()}?</span>
                        <button l:click="confirmDelete" data-admin-confirm-delete>Yes, delete</button>
                        <button l:click="cancelDelete" data-admin-cancel-delete>Cancel</button>
                    @else
                        <%-- Arm the row via the $set magic (the Livewire wire:click="$set(...)" idiom):
                             it mutates the @Wire field server-side and re-renders, showing the confirm.
                             NB there is no l:value directive and l:model binds an INPUT listener a button
                             never fires, so $set is the canonical row-arm, not l:model+l:value. --%>
                        <button l:click="$set('pendingDeleteId', '${row.id()}')" data-admin-delete="${row.id()}">Delete</button>
                    @endif
                </td>
            </tr>
        @endfor
        </tbody>
    </table>
    <nav data-admin-pagination>
        <span data-admin-page>Page ${view.pagination().page()} of ${view.pagination().totalPages()}</span>
        <span data-admin-total>${view.pagination().total()} total</span>
        @if(view.pagination().hasPrevious())
            <button l:click="prev" data-admin-prev>Previous</button>
        @endif
        @if(view.pagination().hasNext())
            <button l:click="next" data-admin-next>Next</button>
        @endif
    </nav>
</div>

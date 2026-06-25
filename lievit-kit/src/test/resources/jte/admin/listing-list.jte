@import dev.lievit.component.ComponentMetadata
@import dev.lievit.kit.AdminListView
@import dev.lievit.kit.Cell
@import dev.lievit.kit.hello.ListingListComponent
@param ListingListComponent _instance
@param String createUrl
@param int page
@param String pendingDeleteId
@param ComponentMetadata _component
!{AdminListView view = _instance.view();}
<div data-lievit-component="${_component.className()}" data-admin-list>
    <h1 data-admin-heading>${view.heading()}</h1>
    <div data-admin-toolbar>
        @for(AdminListView.HeaderAction action : view.headerActions())
            @if(action.hasUrl())
                @if(action.newTab())
                    <a data-admin-header-action="${action.name()}" href="${action.url()}" target="_blank" rel="noopener noreferrer">${action.label()}</a>
                @else
                    <a data-admin-header-action="${action.name()}" href="${action.url()}">${action.label()}</a>
                @endif
            @else
                <button l:click="${action.name()}" data-admin-header-action="${action.name()}">${action.label()}</button>
            @endif
        @endfor
    </div>
    <a data-admin-create href="${createUrl}">New</a>
    @if(view.controls().hasFilters())
        <div data-admin-filters data-filters-layout="${view.controls().filtersLayout().token()}" data-filters-persist="${view.controls().persistFiltersInSession()}">
            <span data-admin-filters-indicator>${view.controls().activeFilterCount()}</span>
            @for(AdminListView.FilterControl filter : view.controls().filterControls())
                <div data-admin-filter="${filter.name()}" data-filter-kind="${filter.kind().name()}" data-filter-active="${filter.active()}">
                    <label>${filter.label()}</label>
                    @if(filter.kind() == AdminListView.FilterControl.Kind.TOGGLE)
                        <input type="checkbox" name="${filter.name()}" l:model="filters.${filter.name()}" checked="${filter.active()}">
                    @else
                        <select name="${filter.name()}" l:model="filters.${filter.name()}" multiple="${filter.multiple()}">
                            @if(filter.hasPlaceholder())
                                <option value="">${filter.placeholder()}</option>
                            @endif
                            @for(java.util.Map.Entry<String, String> opt : filter.options().entrySet())
                                <option value="${opt.getKey()}" selected="${filter.isSelected(opt.getKey())}">${opt.getValue()}</option>
                            @endfor
                        </select>
                    @endif
                </div>
            @endfor
        </div>
    @endif
    <table>
        <thead>
        @if(view.hasHeaderGroups())
            <tr data-admin-header-groups>
                @for(AdminListView.HeaderGroup group : view.headerGroups())
                    @if(group.isGroup())
                        <th colspan="${group.span()}" data-admin-header-group="${group.label()}" data-align="${group.alignment()}">${group.label()}</th>
                    @else
                        <th colspan="${group.span()}" data-admin-header-group-spacer></th>
                    @endif
                @endfor
                <th></th>
            </tr>
        @endif
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
                        <td>@template.lievit.badge(variant = badge.variant(), label = badge.text())</td>
                    @elseif(cell instanceof Cell.Link link)
                        @if(link.newTab())
                            <td><a href="${link.href()}" target="_blank" rel="noopener noreferrer">${link.text()}</a></td>
                        @else
                            <td><a href="${link.href()}">${link.text()}</a></td>
                        @endif
                    @elseif(cell instanceof Cell.Icon icon)
                        <td>@template.icon(name = icon.name(), cssClass = icon.color().isEmpty() ? "" : "text-[var(--lv-color-" + icon.color() + ")]")@if(!icon.text().isEmpty())<span>${icon.text()}</span>@endif</td>
                    @elseif(cell instanceof Cell.Tags tags)
                        <td><span data-tags-cell>@for(String tag : tags.visible())<span data-tag>${tag}</span>@endfor@if(tags.hasOverflow())<span data-tags-overflow>+${tags.overflow()}</span>@endif</span></td>
                    @elseif(cell instanceof Cell.View viewCell)
                        <%-- ViewColumn escape hatch: the fragment is the adopter's trusted
                             server-rendered markup, stamped RAW (the Cell.View trust contract). --%>
                        <td data-admin-view-cell>$unsafe{viewCell.html()}</td>
                    @elseif(cell instanceof Cell.AvatarStack stack)
                        <td><span data-avatar-stack data-shape="${stack.circular() ? "circular" : "square"}">@for(dev.lievit.kit.AvatarStackColumn.Avatar avatar : stack.visible())@if(avatar.hasImage())<img data-avatar src="${avatar.image()}" alt="${avatar.label()}">@else<span data-avatar data-initials title="${avatar.label()}">${avatar.label()}</span>@endif@endfor@if(stack.hasOverflow())@if(stack.hasOverflowUrl())<a data-avatar-overflow href="${stack.overflowUrl()}" title="${stack.overflowTitle()}">+${stack.overflow()}</a>@else<span data-avatar-overflow title="${stack.overflowTitle()}">+${stack.overflow()}</span>@endif@endif</span></td>
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

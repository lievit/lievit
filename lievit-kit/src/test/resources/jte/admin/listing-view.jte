@import java.util.Map
@import dev.lievit.component.ComponentMetadata
@import dev.lievit.kit.AdminViewView
@import dev.lievit.kit.hello.ListingViewComponent
@param ListingViewComponent _instance
@param String recordId
@param boolean notFound
@param boolean forbidden
@param ComponentMetadata _component
!{AdminViewView view = _instance.view();}
<div data-lievit-component="${_component.className()}" data-admin-view>
    @if(forbidden)
        <p data-admin-forbidden>You are not allowed to view this record.</p>
    @elseif(notFound || view == null)
        <p data-admin-not-found>Record not found.</p>
    @else
        <header data-admin-view-header>
            <h1 data-admin-heading>${view.heading()}</h1>
            @if(view.hasHeaderActions())
                <nav data-admin-view-actions>
                    @for(AdminViewView.HeaderAction action : view.headerActions())
                        <a href="${action.url()}" data-admin-view-action="${action.label()}" data-variant="${action.variant()}">${action.label()}</a>
                    @endfor
                </nav>
            @endif
        </header>
        @for(AdminViewView.Section section : view.sections())
            <section data-admin-view-section data-admin-view-columns="${section.columns()}">
                @if(section.hasHeading())
                    <h2 data-admin-section-heading>${section.heading()}</h2>
                @endif
                <dl data-admin-view-entries>
                    @for(Map.Entry<String, String> entry : section.entries().entrySet())
                        <div data-admin-view-entry="${entry.getKey()}">
                            <dt>${entry.getKey()}</dt>
                            <dd>${entry.getValue()}</dd>
                        </div>
                    @endfor
                </dl>
            </section>
        @endfor
    @endif
</div>

@import io.lievit.component.LievitSlots
@import io.lievit.component.ComponentMetadata
@param ComponentMetadata _component
!{var slots = LievitSlots.current();}
<div data-card>
    @if(slots.has("header"))
        <div data-card-header>$unsafe{slots.get("header")}</div>
    @endif
    <div data-card-body>$unsafe{slots.slot()}</div>
</div>

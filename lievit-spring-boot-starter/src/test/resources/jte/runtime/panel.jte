@import io.lievit.component.ComponentMetadata
@param int count
@param boolean open
@param int views
@param int lastEventId
@param boolean booted
@param boolean rendered
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <span data-count>${count}</span>
    <span data-open>${open}</span>
    <span data-views>${views}</span>
    <button l:click="save">save</button>
    <button l:click="leave">leave</button>
    <button l:click="track">track</button>
    <button l:click="$set('count', 5)">set</button>
    <button l:click="$toggle('open')">toggle</button>
</div>

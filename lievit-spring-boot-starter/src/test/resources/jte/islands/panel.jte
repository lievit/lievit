@import dev.lievit.component.LievitIsland
@import dev.lievit.component.ComponentMetadata
@param int feed
@param String outside
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <p data-outside>${outside}</p>
    $unsafe{LievitIsland.open("feed")}
    <div data-feed-count>${feed}</div>
    $unsafe{LievitIsland.close("feed")}
    <button l:click="refreshFeed" l:island="feed">refresh</button>
</div>

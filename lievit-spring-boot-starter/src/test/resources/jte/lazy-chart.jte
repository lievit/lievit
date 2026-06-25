@import dev.lievit.component.ComponentMetadata
@param int points
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <canvas data-chart data-points="${points}">heavy chart with ${points} points</canvas>
</div>

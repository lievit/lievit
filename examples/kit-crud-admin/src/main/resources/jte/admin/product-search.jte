@import io.lievit.component.ComponentMetadata
@import io.lievit.example.admin.product.Product
@import io.lievit.example.admin.product.ProductSearchComponent
@param String term
@param ComponentMetadata _component
@param ProductSearchComponent _instance
<div data-lievit-component="${_component.className()}" class="search">
    <label>Live search (over the wire):
        <input type="text" value="${term}" l:model.live="term" placeholder="name or SKU...">
    </label>
    <ul data-search-results>
        @for(Product p : _instance.results())
            <li data-search-result>${p.name()} <small>(${p.sku()})</small></li>
        @endfor
    </ul>
    @if(_instance.results().isEmpty())
        <p data-search-empty>No products match "${term}".</p>
    @endif
</div>

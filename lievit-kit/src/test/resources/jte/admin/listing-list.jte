@import java.util.List
@import com.iambilotta.lievit.component.ComponentMetadata
@import com.iambilotta.lievit.kit.hello.AdminListView
@param String heading
@param List<String> headers
@param List<AdminListView.Row> rows
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}" data-admin-list>
    <h1 data-admin-heading>${heading}</h1>
    <table>
        <thead>
        <tr>
            @for(String header : headers)
                <th>${header}</th>
            @endfor
        </tr>
        </thead>
        <tbody>
        @for(AdminListView.Row row : rows)
            <tr data-admin-row="${row.id()}">
                @for(String cell : row.cells())
                    <td>${cell}</td>
                @endfor
            </tr>
        @endfor
        </tbody>
    </table>
</div>

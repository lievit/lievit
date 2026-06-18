@param java.util.List<String> rows
<div data-lievit-component>
    <form l:submit="save">
        <input l:model.live="query">
        <button l:click="$set('pendingDeleteId', '1')">Delete</button>
        <button l:keydown.enter="next">Next</button>
    </form>
</div>

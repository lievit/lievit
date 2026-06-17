@import com.iambilotta.lievit.component.ComponentMetadata
@param String username
@param String password
@param String passwordConfirm
@param String error
@param String redirectTo
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    @if(!error.isBlank())
        <p style="color:red" data-register-error>${error}</p>
    @endif
    <form>
        <div>
            <label for="reg-username">Username</label>
            <input id="reg-username" type="text" name="username" value="${username}"
                   l:model="username" autocomplete="username" autofocus>
        </div>
        <div>
            <label for="reg-password">Password</label>
            <input id="reg-password" type="password" name="password" value="${password}"
                   l:model="password" autocomplete="new-password">
        </div>
        <div>
            <label for="reg-confirm">Confirm password</label>
            <input id="reg-confirm" type="password" name="passwordConfirm" value="${passwordConfirm}"
                   l:model="passwordConfirm" autocomplete="new-password">
        </div>
        <button type="button" l:click="register">Create account</button>
    </form>
    @if(!redirectTo.isBlank())
        <%-- Server signals successful registration: navigate the browser to the login page. --%>
        <script>window.location.assign("${redirectTo}")</script>
    @endif
</div>

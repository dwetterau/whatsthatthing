import {useAuth0} from "@auth0/auth0-react";
import { useConvexAuth } from "convex/react";

export const Authentication = () => {
    const {isLoading, isAuthenticated} = useConvexAuth();
    const {user, loginWithRedirect, logout} = useAuth0();    
    if (isLoading) {
        return <span>Loading...</span>
    }
    if (!isAuthenticated) {
        return <button onClick={() => loginWithRedirect()}>Login</button>
    }
    if (user) {
        return (
            <div>
            <span>Logged in as {user.name}</span>
            <span style={{marginLeft: '1em'}}>
                    <button onClick={() => logout({logoutParams: {returnTo: window.location.origin}})}>
                        Log out
                    </button>
                </span>
            </div>
        )

    }
    return <span>Unknown login state</span>
}
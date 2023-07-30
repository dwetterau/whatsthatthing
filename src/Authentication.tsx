import {useAuth0} from "@auth0/auth0-react";
import { useConvexAuth, useMutation } from "convex/react";
import {api} from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useEffect, useState } from "react";

const useStoreUserEffect = () => {
    const {isAuthenticated} = useConvexAuth();
    const {user} = useAuth0();

    const [userId, setUserId] = useState<Id<"users"> | null>(null);
    const storeUser = useMutation(api.users.store);
    
    useEffect(() => {
        if (!isAuthenticated || userId !== null) {
            return;
        }
        async function createUser() {
            const id = await storeUser();
            setUserId(id);
        }
        createUser();
        return () => {setUserId(null)};
    }, [isAuthenticated, storeUser, user?.id]);

    return userId;
};

export const Authentication = () => {
    const {isLoading, isAuthenticated} = useConvexAuth();
    const {user, loginWithRedirect, logout} = useAuth0();
    const userId = useStoreUserEffect();
    
    if (isLoading) {
        return <span>Loading...</span>
    }
    if (!isAuthenticated) {
        return <button onClick={() => loginWithRedirect()}>Login</button>
    }
    if (user) {
        return (
            <div>
            <span>Logged in as {user.name} ({userId})</span>
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
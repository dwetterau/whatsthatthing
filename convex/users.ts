import { Id } from "./_generated/dataModel";
import {MutationCtx, QueryCtx, mutation} from "./_generated/server";

export const getLoggedInUserIdOrError = async (ctx: QueryCtx | MutationCtx): Promise<Id<'users'>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new Error("called user_achievements.add without authentication present");
    }
    const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => (
            q.eq("tokenIdentifier", identity.tokenIdentifier)
        ))
        .unique();
        
    if (user === null) {
        throw new Error("user not stored in database");
    }
    return user._id;
}

export const store = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("called user.store without authentication present");
        }

        // Check if the user exists already.
        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) => (
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            ))
            .unique();
        
        if (user !== null) {
            // We've seen this user before, patch up the values.
            if (user.name !== identity.name) {
                await ctx.db.patch(user._id, {name: identity.name});
            }
            return user._id;
        }
        
        // Create a new user object.
        return await ctx.db.insert("users", {
            name: identity.name!,
            tokenIdentifier: identity.tokenIdentifier,
        });
    },
})
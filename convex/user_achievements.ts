import { Id } from "./_generated/dataModel";
import {mutation} from "./_generated/server";
import {v} from "convex/values";

export const add = mutation({
    args: {
        achievementId: v.id("achievements"),
    },
    handler: async (ctx, args): Promise<Id<'userAchievements'>> => {
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

        // Check that the achievement exists
        const achievement = await ctx.db.get(args.achievementId);
        if (achievement === null) {
            throw new Error("achievement doesn't exist");
        }

        // Check if the user has the achievement already.
        const userAchievement = await ctx.db
            .query("userAchievements")
            .withIndex("by_user", (q) => {
                return q.eq("userId", user._id)
            })
            .filter(q => {
                return q.eq(q.field("achievementId"), args.achievementId)
            })
            .unique();

        if (userAchievement === null) {
            return await ctx.db.insert("userAchievements", {
                userId: user._id,
                achievementId: args.achievementId,
            })
        }
        return userAchievement._id;
    },
})
import { Doc, Id } from "./_generated/dataModel";
import {mutation, query} from "./_generated/server";
import {v} from "convex/values";
import { getLoggedInUserIdOrError } from "./users";

export const list = query({
    args: {},
    handler: async (ctx): Promise<Array<Doc<'userAchievements'> & {achievement: Doc<'achievements'>}>> => {
        const userId = await getLoggedInUserIdOrError(ctx);
        const userAchievements = await ctx.db
            .query("userAchievements")
            .withIndex("by_user", (q) => {
                return q.eq("userId", userId)
            })
            .order("desc")
            .collect();
        const possiblyMissingAchievements = await Promise.all(
            userAchievements.map((userAchievement) => {
                return ctx.db.get(userAchievement.achievementId); 
            })
        );
        const final: Array<Doc<'userAchievements'> & {achievement: Doc<'achievements'>}> = [];
        for (let i = 0; i < userAchievements.length; i++) {
            const achievement = possiblyMissingAchievements[i];
            if (!achievement) {
                continue;
            }
            final.push({
                ...userAchievements[i],
                achievement,
            })
        }
        return final;
    }
})

export const add = mutation({
    args: {
        achievementId: v.id("achievements"),
    },
    handler: async (ctx, args): Promise<Id<'userAchievements'>> => {
        const userId = await getLoggedInUserIdOrError(ctx);
        // Check that the achievement exists
        const achievement = await ctx.db.get(args.achievementId);
        if (achievement === null) {
            throw new Error("achievement doesn't exist");
        }

        // Check if the user has the achievement already.
        const userAchievement = await ctx.db
            .query("userAchievements")
            .withIndex("by_user", (q) => {
                return q.eq("userId", userId)
            })
            .filter(q => {
                return q.eq(q.field("achievementId"), args.achievementId)
            })
            .unique();

        if (userAchievement === null) {
            return await ctx.db.insert("userAchievements", {
                userId: userId,
                achievementId: args.achievementId,
            })
        }
        return userAchievement._id;
    },
})
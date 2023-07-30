import {defineSchema, defineTable} from "convex/server";
import {v} from "convex/values";

export default defineSchema({
    achievements: defineTable({
        category: v.string(),
        name: v.string(),
        description: v.string(),
    }),
    users: defineTable({
        name: v.string(),
        tokenIdentifier: v.string(),
    }).index("by_token", ["tokenIdentifier"])
})
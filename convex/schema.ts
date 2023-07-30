import {defineSchema, defineTable} from "convex/server";
import {v} from "convex/values";

export default defineSchema({
    achievements: defineTable({
        name: v.string(),
        description: v.string(),
    }),
})
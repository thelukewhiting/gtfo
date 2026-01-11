import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const register = mutation({
  args: {
    pushToken: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_push_token", (q) => q.eq("pushToken", args.pushToken))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        latitude: args.latitude,
        longitude: args.longitude,
        timezone: args.timezone,
        lastLocationUpdate: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("devices", {
      pushToken: args.pushToken,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone: args.timezone,
      lastLocationUpdate: Date.now(),
      notifyMorning: true,
      notifyHourBefore: true,
      minQuality: "Good",
    });
  },
});

export const updateLocation = mutation({
  args: {
    pushToken: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_push_token", (q) => q.eq("pushToken", args.pushToken))
      .first();

    if (!device) {
      // Auto-register device if not found
      await ctx.db.insert("devices", {
        pushToken: args.pushToken,
        latitude: args.latitude,
        longitude: args.longitude,
        timezone: args.timezone ?? "UTC",
        lastLocationUpdate: Date.now(),
        notifyMorning: true,
        notifyHourBefore: true,
        minQuality: "Good",
      });
      return;
    }

    await ctx.db.patch(device._id, {
      latitude: args.latitude,
      longitude: args.longitude,
      ...(args.timezone ? { timezone: args.timezone } : {}),
      lastLocationUpdate: Date.now(),
    });
  },
});

export const updatePreferences = mutation({
  args: {
    pushToken: v.string(),
    notifyMorning: v.optional(v.boolean()),
    notifyHourBefore: v.optional(v.boolean()),
    notifyTenMinBefore: v.optional(v.boolean()),
    minQuality: v.optional(v.union(v.literal("Fair"), v.literal("Good"), v.literal("Great"))),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_push_token", (q) => q.eq("pushToken", args.pushToken))
      .first();

    if (!device) {
      throw new Error("Device not found");
    }

    const updates: Partial<{
      notifyMorning: boolean;
      notifyHourBefore: boolean;
      notifyTenMinBefore: boolean;
      minQuality: "Fair" | "Good" | "Great";
    }> = {};

    if (args.notifyMorning !== undefined) updates.notifyMorning = args.notifyMorning;
    if (args.notifyHourBefore !== undefined) updates.notifyHourBefore = args.notifyHourBefore;
    if (args.notifyTenMinBefore !== undefined) updates.notifyTenMinBefore = args.notifyTenMinBefore;
    if (args.minQuality !== undefined) updates.minQuality = args.minQuality;

    await ctx.db.patch(device._id, updates);
  },
});

export const getByToken = query({
  args: { pushToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_push_token", (q) => q.eq("pushToken", args.pushToken))
      .first();
  },
});

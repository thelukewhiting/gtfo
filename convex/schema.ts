import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  devices: defineTable({
    pushToken: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    timezone: v.string(),
    lastLocationUpdate: v.number(),
    notifyMorning: v.boolean(),
    notifyHourBefore: v.boolean(),
    minQuality: v.union(v.literal("Fair"), v.literal("Good"), v.literal("Great")),
  }).index("by_push_token", ["pushToken"]),

  notifications: defineTable({
    deviceId: v.id("devices"),
    sentAt: v.number(),
    type: v.union(v.literal("morning"), v.literal("reminder")),
    sunsetTime: v.string(),
    quality: v.string(),
    qualityPercent: v.number(),
  }).index("by_device", ["deviceId"]),

  pendingReminders: defineTable({
    deviceId: v.id("devices"),
    scheduledFor: v.number(),
    sunsetTime: v.string(),
    quality: v.string(),
    qualityPercent: v.number(),
  }).index("by_scheduled_time", ["scheduledFor"]),
});

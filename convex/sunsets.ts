import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const SUNSETWX_API_URL = "https://sunburst.sunsetwx.com/v1/quality";
const DEMO_MODE = !process.env.SUNSETWX_API_KEY;

interface SunsetQuality {
  quality: "Poor" | "Fair" | "Good" | "Great";
  qualityPercent: number;
  sunsetTime: string;
  validAt: string;
  isDemo?: boolean;
}

function generateMockSunset(latitude: number): SunsetQuality {
  // Generate a pseudo-random quality based on current date (so it's consistent within a day)
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const seed = (dayOfYear * 7 + Math.floor(Math.abs(latitude))) % 100;

  let quality: "Poor" | "Fair" | "Good" | "Great";
  let qualityPercent: number;

  if (seed < 25) {
    quality = "Poor";
    qualityPercent = 5 + (seed % 12);
  } else if (seed < 50) {
    quality = "Fair";
    qualityPercent = 20 + (seed % 30);
  } else if (seed < 80) {
    quality = "Good";
    qualityPercent = 52 + (seed % 23);
  } else {
    quality = "Great";
    qualityPercent = 76 + (seed % 24);
  }

  // Calculate approximate sunset time
  // For demo, use a fixed evening time that makes sense (5:00 PM - 7:30 PM range)
  // Vary slightly based on day of year for realism
  const baseMinutes = 17 * 60 + 30; // 5:30 PM in minutes
  const seasonalOffset = Math.sin((dayOfYear - 80) * 2 * Math.PI / 365) * 90; // +/- 90 minutes
  const sunsetMinutes = Math.round(baseMinutes + seasonalOffset);

  const sunsetHour = Math.floor(sunsetMinutes / 60);
  const sunsetMin = sunsetMinutes % 60;

  // Return time as a simple string that will be parsed correctly on client
  // Format: today's date with the calculated evening time
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');
  const day = String(today.getUTCDate()).padStart(2, '0');

  // Create ISO string with the sunset time (treating it as local time for display)
  const sunsetTime = `${year}-${month}-${day}T${String(sunsetHour).padStart(2, '0')}:${String(sunsetMin).padStart(2, '0')}:00`;

  return {
    quality,
    qualityPercent,
    sunsetTime,
    validAt: sunsetTime,
    isDemo: true,
  };
}

async function fetchSunsetQuality(
  latitude: number,
  longitude: number,
  apiKey: string
): Promise<SunsetQuality | null> {
  try {
    const response = await fetch(
      `${SUNSETWX_API_URL}?geo=${latitude},${longitude}&type=sunset`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error("SunsetWX API error:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const props = feature.properties;

    return {
      quality: props.quality,
      qualityPercent: props.quality_percent,
      sunsetTime: props.valid_at,
      validAt: props.valid_at,
    };
  } catch (error) {
    console.error("Failed to fetch sunset quality:", error);
    return null;
  }
}

export const getSunsetQuality = action({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args): Promise<SunsetQuality | null> => {
    const apiKey = process.env.SUNSETWX_API_KEY;

    // Demo mode: return mock data when no API key
    if (!apiKey) {
      console.log("SUNSETWX_API_KEY not configured - using demo mode");
      return generateMockSunset(args.latitude);
    }

    return await fetchSunsetQuality(args.latitude, args.longitude, apiKey);
  },
});

export const getAllDevices = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("devices").collect();
  },
});

export const recordNotification = internalMutation({
  args: {
    deviceId: v.id("devices"),
    type: v.union(v.literal("morning"), v.literal("reminder")),
    sunsetTime: v.string(),
    quality: v.string(),
    qualityPercent: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      deviceId: args.deviceId,
      sentAt: Date.now(),
      type: args.type,
      sunsetTime: args.sunsetTime,
      quality: args.quality,
      qualityPercent: args.qualityPercent,
    });
  },
});

export const schedulePendingReminder = internalMutation({
  args: {
    deviceId: v.id("devices"),
    scheduledFor: v.number(),
    sunsetTime: v.string(),
    quality: v.string(),
    qualityPercent: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pendingReminders", {
      deviceId: args.deviceId,
      scheduledFor: args.scheduledFor,
      sunsetTime: args.sunsetTime,
      quality: args.quality,
      qualityPercent: args.qualityPercent,
    });
  },
});

export const getDueReminders = internalQuery({
  args: { currentTime: v.number() },
  handler: async (ctx, args) => {
    const reminders = await ctx.db
      .query("pendingReminders")
      .withIndex("by_scheduled_time")
      .collect();

    return reminders.filter((r) => r.scheduledFor <= args.currentTime);
  },
});

export const deleteReminder = internalMutation({
  args: { id: v.id("pendingReminders") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

const QUALITY_THRESHOLD: Record<string, number> = {
  Fair: 17.63,
  Good: 50,
  Great: 75,
};

export const checkMorningSunsets = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.SUNSETWX_API_KEY;
    const isDemoMode = !apiKey;

    if (isDemoMode) {
      console.log("Running checkMorningSunsets in demo mode");
    }

    const devices = await ctx.runQuery(internal.sunsets.getAllDevices);

    for (const device of devices) {
      if (!device.notifyMorning) continue;

      const quality = isDemoMode
        ? generateMockSunset(device.latitude)
        : await fetchSunsetQuality(device.latitude, device.longitude, apiKey!);

      if (!quality) continue;

      const threshold = QUALITY_THRESHOLD[device.minQuality];
      if (quality.qualityPercent < threshold) continue;

      // Send morning notification
      await sendPushNotification(
        device.pushToken,
        "Tonight's sunset looks " + quality.quality + "!",
        `${quality.quality} sunset (${Math.round(quality.qualityPercent)}%) expected at ${formatTime(quality.sunsetTime)}. Time to find a good spot!`
      );

      await ctx.runMutation(internal.sunsets.recordNotification, {
        deviceId: device._id,
        type: "morning",
        sunsetTime: quality.sunsetTime,
        quality: quality.quality,
        qualityPercent: quality.qualityPercent,
      });

      // Schedule reminder if enabled
      if (device.notifyHourBefore) {
        const sunsetTimestamp = new Date(quality.sunsetTime).getTime();
        const reminderTime = sunsetTimestamp - 60 * 60 * 1000; // 1 hour before

        if (reminderTime > Date.now()) {
          await ctx.runMutation(internal.sunsets.schedulePendingReminder, {
            deviceId: device._id,
            scheduledFor: reminderTime,
            sunsetTime: quality.sunsetTime,
            quality: quality.quality,
            qualityPercent: quality.qualityPercent,
          });
        }
      }
    }
  },
});

export const sendDueReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const dueReminders = await ctx.runQuery(internal.sunsets.getDueReminders, {
      currentTime: Date.now(),
    });

    for (const reminder of dueReminders) {
      const device = await ctx.runQuery(internal.sunsets.getDeviceById, {
        id: reminder.deviceId,
      });

      if (device) {
        await sendPushNotification(
          device.pushToken,
          "Head outside now!",
          `${reminder.quality} sunset in about 1 hour. GTFO and enjoy it!`
        );

        await ctx.runMutation(internal.sunsets.recordNotification, {
          deviceId: device._id,
          type: "reminder",
          sunsetTime: reminder.sunsetTime,
          quality: reminder.quality,
          qualityPercent: reminder.qualityPercent,
        });
      }

      await ctx.runMutation(internal.sunsets.deleteReminder, {
        id: reminder._id,
      });
    }
  },
});

export const getDeviceById = internalQuery({
  args: { id: v.id("devices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string
) {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: "default",
        title,
        body,
        data: { type: "sunset" },
      }),
    });

    const result = await response.json();
    if (result.data?.status === "error") {
      console.error("Push notification error:", result.data.message);
    }
  } catch (error) {
    console.error("Failed to send push notification:", error);
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export const sendTestNotification = action({
  args: {
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    await sendPushNotification(
      args.pushToken,
      "Test Notification",
      "GTFO is working! You'll get notified about great sunsets."
    );
    return { success: true };
  },
});

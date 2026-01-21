import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const SUNSETHUE_API_URL = "https://api.sunsethue.com";
const DEMO_MODE = !process.env.SUNSETHUE_API_KEY;

interface SunsetQuality {
  quality: "Poor" | "Fair" | "Good" | "Great" | "Excellent";
  qualityPercent: number;
  sunsetTime: string;
  validAt: string;
  isDemo?: boolean;
  // Additional API fields
  cloudCover?: number; // percentage 0-100
  sunsetAzimuth?: number; // degrees from north (direction)
  goldenHourStart?: string;
  goldenHourEnd?: string;
  blueHourStart?: string;
  blueHourEnd?: string;
}

function normalizeQualityText(value: string | undefined): SunsetQuality["quality"] | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  switch (normalized) {
    case "poor":
      return "Poor";
    case "fair":
      return "Fair";
    case "good":
      return "Good";
    case "great":
      return "Great";
    case "excellent":
      return "Excellent";
    default:
      return null;
  }
}

function formatDateForTimezone(date: Date, timeZone: string | undefined): string {
  try {
    if (!timeZone) throw new Error("Missing timezone");
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${mapped.year}-${mapped.month}-${mapped.day}`;
  } catch {
    return date.toISOString().split("T")[0];
  }
}

// Convert a local time (hour:minute) in a timezone to UTC ISO string
function localTimeToUTC(dateStr: string, hour: number, minute: number, timezone?: string): string {
  const localTimeStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

  if (!timezone) {
    return localTimeStr;
  }

  try {
    // Strategy: binary search to find the UTC time that displays as our target local time
    // Start with a guess (treat local time as UTC, then adjust)
    const naiveUtc = new Date(`${localTimeStr}Z`).getTime();

    // Format a date in the target timezone and extract hour/minute
    const getLocalTime = (utcMs: number): { hour: number; minute: number } => {
      const d = new Date(utcMs);
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      return { hour: h, minute: m };
    };

    // Calculate how far off we are and adjust
    const targetMinutes = hour * 60 + minute;
    const guessLocal = getLocalTime(naiveUtc);
    const guessMinutes = guessLocal.hour * 60 + guessLocal.minute;

    let diffMinutes = guessMinutes - targetMinutes;
    // Handle day wraparound
    if (diffMinutes > 720) diffMinutes -= 1440;
    if (diffMinutes < -720) diffMinutes += 1440;

    // Adjust: if local shows later than target, we need earlier UTC (subtract the diff)
    const correctedUtc = naiveUtc - diffMinutes * 60 * 1000;

    return new Date(correctedUtc).toISOString();
  } catch {
    return localTimeStr;
  }
}

function generateMockSunset(latitude: number, timezone?: string): SunsetQuality {
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

  // Calculate approximate sunset time (5:00 PM - 7:30 PM range based on season)
  const baseMinutes = 17 * 60 + 30; // 5:30 PM
  const seasonalOffset = Math.sin((dayOfYear - 80) * 2 * Math.PI / 365) * 90;
  const sunsetMinutes = Math.round(baseMinutes + seasonalOffset);

  const dateStr = formatDateForTimezone(today, timezone);

  // Helper to create UTC ISO string from local minutes
  const makeTimeString = (minutes: number): string => {
    const hour = Math.floor(minutes / 60) % 24;
    const min = minutes % 60;
    return localTimeToUTC(dateStr, hour, min, timezone);
  };

  const sunsetTime = makeTimeString(sunsetMinutes);
  const goldenHourStart = makeTimeString(sunsetMinutes - 60);
  const goldenHourEnd = sunsetTime;
  const blueHourStart = sunsetTime;
  const blueHourEnd = makeTimeString(sunsetMinutes + 30);

  // Demo cloud cover and direction
  const cloudCover = 30 + (seed % 40); // 30-70%
  const sunsetAzimuth = 240 + (dayOfYear * 0.2) % 60; // ~240-300 degrees (W to WNW)

  return {
    quality,
    qualityPercent,
    sunsetTime,
    validAt: sunsetTime,
    isDemo: true,
    cloudCover,
    sunsetAzimuth,
    goldenHourStart,
    goldenHourEnd,
    blueHourStart,
    blueHourEnd,
  };
}

type FetchResult =
  | { success: true; data: SunsetQuality }
  | { success: false; error: string; statusCode?: number };

async function fetchSunsetQuality(
  latitude: number,
  longitude: number,
  apiKey: string,
  dateStr: string
): Promise<FetchResult> {
  try {
    const response = await fetch(
      `${SUNSETHUE_API_URL}/event?latitude=${latitude}&longitude=${longitude}&date=${dateStr}&type=sunset`,
      {
        headers: {
          "x-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sunsethue API error:", response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}`, statusCode: response.status };
    }

    const result = await response.json();

    // Handle error responses
    if (typeof result.status === "number" && (result.status === 400 || result.status === 500)) {
      console.error("Sunsethue API returned error:", result.code, result.message);
      return { success: false, error: `API error ${result.code}: ${result.message}`, statusCode: result.status };
    }

    const data = result.data;

    // Check if model data is available
    if (!data || !data.model_data) {
      console.log("No model data available for this location/date");
      return { success: false, error: "No model data available for this location/date" };
    }

    if (typeof data.quality !== "number") {
      console.error("Sunsethue API missing quality data");
      return { success: false, error: "API response missing quality data" };
    }

    const qualityText = normalizeQualityText(data.quality_text);
    if (!qualityText) {
      console.error("Sunsethue API returned unknown quality_text:", data.quality_text);
      return { success: false, error: `Unknown quality_text: ${data.quality_text}` };
    }

    // quality is 0-1, convert to percent
    const qualityPercent = Math.round(data.quality * 100);

    // Extract additional fields from API response
    // Cloud cover (may be cloud_cover or clouds, normalize to percentage)
    const cloudCover = typeof data.cloud_cover === "number"
      ? Math.round(data.cloud_cover * 100)
      : typeof data.clouds === "number"
        ? Math.round(data.clouds * 100)
        : undefined;

    return {
      success: true,
      data: {
        quality: qualityText,
        qualityPercent,
        sunsetTime: data.time,
        validAt: data.time,
        cloudCover,
        sunsetAzimuth: data.direction,
        goldenHourStart: data.magics?.golden_hour?.[0],
        goldenHourEnd: data.magics?.golden_hour?.[1],
        blueHourStart: data.magics?.blue_hour?.[0],
        blueHourEnd: data.magics?.blue_hour?.[1],
      },
    };
  } catch (error) {
    console.error("Failed to fetch sunset quality:", error);
    return { success: false, error: `Exception: ${error}` };
  }
}

export const getSunsetQuality = action({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    date: v.string(),
  },
  handler: async (ctx, args): Promise<SunsetQuality | null> => {
    const apiKey = process.env.SUNSETHUE_API_KEY;

    if (!apiKey) {
      console.log("SUNSETHUE_API_KEY not configured - using demo mode");
      return generateMockSunset(args.latitude);
    }

    const result = await fetchSunsetQuality(args.latitude, args.longitude, apiKey, args.date);
    return result.success ? result.data : null;
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
    reminderType: v.optional(v.union(v.literal("hour"), v.literal("tenmin"))),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pendingReminders", {
      deviceId: args.deviceId,
      scheduledFor: args.scheduledFor,
      sunsetTime: args.sunsetTime,
      quality: args.quality,
      qualityPercent: args.qualityPercent,
      reminderType: args.reminderType,
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

// Sunsethue quality ranges: Poor 0-20%, Fair 21-40%, Good 41-60%, Great 61-80%, Excellent 81-100%
const QUALITY_THRESHOLD: Record<string, number> = {
  Fair: 21,
  Good: 41,
  Great: 61,
  Excellent: 81,
};

function getLocalHour(timezone: string | undefined): number | null {
  try {
    if (!timezone) return null;
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(now), 10);
  } catch {
    return null;
  }
}

export const checkMorningSunsets = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.SUNSETHUE_API_KEY;
    const isDemoMode = !apiKey;

    if (isDemoMode) {
      console.log("Running checkMorningSunsets in demo mode");
    }

    const devices = await ctx.runQuery(internal.sunsets.getAllDevices);

    for (const device of devices) {
      if (!device.notifyMorning) continue;

      // Only notify devices where it's currently 11 AM - 4 PM local time
      // This gives the API multiple chances if data isn't ready at 11 AM
      const localHour = getLocalHour(device.timezone);
      if (localHour === null || localHour < 11 || localHour > 16) continue;

      // Check if we already sent a morning notification today (deduplication)
      const alreadySentToday = await ctx.runQuery(
        internal.sunsets.hasMorningNotificationToday,
        { deviceId: device._id, timezone: device.timezone }
      );
      if (alreadySentToday) continue;

      const dateStr = formatDateForTimezone(new Date(), device.timezone);
      let quality: SunsetQuality | null;
      if (isDemoMode) {
        quality = generateMockSunset(device.latitude, device.timezone);
      } else {
        const result = await fetchSunsetQuality(device.latitude, device.longitude, apiKey!, dateStr);
        quality = result.success ? result.data : null;
      }

      if (!quality) continue;

      const threshold = QUALITY_THRESHOLD[device.minQuality];
      if (quality.qualityPercent < threshold) continue;

      // Send morning notification
      await sendPushNotification(
        device.pushToken,
        "Tonight's sunset looks " + quality.quality + "!",
        `${quality.quality} sunset (${Math.round(quality.qualityPercent)}%) expected at ${formatTime(quality.sunsetTime, device.timezone)}. Time to find a good spot!`
      );

      await ctx.runMutation(internal.sunsets.recordNotification, {
        deviceId: device._id,
        type: "morning",
        sunsetTime: quality.sunsetTime,
        quality: quality.quality,
        qualityPercent: quality.qualityPercent,
      });

      // Schedule reminders if enabled
      const sunsetTimestamp = new Date(quality.sunsetTime).getTime();

      if (device.notifyHourBefore) {
        const reminderTime = sunsetTimestamp - 60 * 60 * 1000; // 1 hour before

        if (reminderTime > Date.now()) {
          await ctx.runMutation(internal.sunsets.schedulePendingReminder, {
            deviceId: device._id,
            scheduledFor: reminderTime,
            sunsetTime: quality.sunsetTime,
            quality: quality.quality,
            qualityPercent: quality.qualityPercent,
            reminderType: "hour",
          });
        }
      }

      if (device.notifyTenMinBefore) {
        const tenMinReminderTime = sunsetTimestamp - 10 * 60 * 1000; // 10 minutes before

        if (tenMinReminderTime > Date.now()) {
          await ctx.runMutation(internal.sunsets.schedulePendingReminder, {
            deviceId: device._id,
            scheduledFor: tenMinReminderTime,
            sunsetTime: quality.sunsetTime,
            quality: quality.quality,
            qualityPercent: quality.qualityPercent,
            reminderType: "tenmin",
          });
        }
      }
    }
  },
});

export const sendDueReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.SUNSETHUE_API_KEY;
    const isDemoMode = !apiKey;

    const dueReminders = await ctx.runQuery(internal.sunsets.getDueReminders, {
      currentTime: Date.now(),
    });

    for (const reminder of dueReminders) {
      const device = await ctx.runQuery(internal.sunsets.getDeviceById, {
        id: reminder.deviceId,
      });

      if (device) {
        // Re-check sunset quality at the device's CURRENT location
        // This handles same-day travel (e.g., SF to Bodega Bay)
        const dateStr = formatDateForTimezone(new Date(), device.timezone);
        let currentQuality: SunsetQuality | null;

        if (isDemoMode) {
          currentQuality = generateMockSunset(device.latitude, device.timezone);
        } else {
          const result = await fetchSunsetQuality(
            device.latitude,
            device.longitude,
            apiKey!,
            dateStr
          );
          currentQuality = result.success ? result.data : null;
        }

        // Check if quality at current location still meets user's threshold
        const threshold = QUALITY_THRESHOLD[device.minQuality];
        const meetsThreshold = currentQuality && currentQuality.qualityPercent >= threshold;

        if (meetsThreshold && currentQuality) {
          const isTenMin = reminder.reminderType === "tenmin";
          const title = isTenMin ? "Sunset starting soon!" : "Head outside now!";
          const body = isTenMin
            ? `${currentQuality.quality} sunset in about 10 minutes. GTFO!`
            : `${currentQuality.quality} sunset in about 1 hour. GTFO and enjoy it!`;

          await sendPushNotification(device.pushToken, title, body);

          await ctx.runMutation(internal.sunsets.recordNotification, {
            deviceId: device._id,
            type: "reminder",
            sunsetTime: currentQuality.sunsetTime,
            quality: currentQuality.quality,
            qualityPercent: currentQuality.qualityPercent,
          });
        } else {
          console.log(
            `Skipping reminder for device ${device._id}: quality at current location ` +
            `(${currentQuality?.qualityPercent ?? 'unknown'}%) doesn't meet threshold (${threshold}%)`
          );
        }
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

function formatTime(isoString: string, timezone?: string): string {
  const date = new Date(isoString);
  try {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    });
  } catch {
    // Fallback if timezone is invalid
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
}

export const sendTestNotification = action({
  args: {
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the device exists before sending - prevents arbitrary token abuse
    const device = await ctx.runQuery(internal.sunsets.getDeviceByToken, {
      pushToken: args.pushToken,
    });
    if (!device) {
      throw new Error("Device not registered");
    }

    await sendPushNotification(
      args.pushToken,
      "Test Notification",
      "GTFO is working! You'll get notified about great sunsets."
    );
    return { success: true };
  },
});

// Internal only - prevents public abuse for mass notifications
export const broadcastNotification = internalAction({
  args: {
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const devices = await ctx.runQuery(internal.sunsets.getAllDevices);
    let sent = 0;
    for (const device of devices) {
      await sendPushNotification(device.pushToken, args.title, args.body);
      sent++;
    }
    return { sent };
  },
});

export const debugSunsetCheck = action({
  args: {
    pushToken: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    device: {
      found: boolean;
      notifyMorning?: boolean;
      notifyHourBefore?: boolean;
      minQuality?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
    };
    sunset: {
      fetched: boolean;
      quality?: string;
      qualityPercent?: number;
      sunsetTime?: string;
      isDemo?: boolean;
      error?: string;
    };
    notification: {
      wouldSend: boolean;
      reason: string;
      threshold?: number;
    };
  }> => {
    const apiKey = process.env.SUNSETHUE_API_KEY;
    const isDemoMode = !apiKey;

    // Find device
    const device = await ctx.runQuery(internal.sunsets.getDeviceByToken, {
      pushToken: args.pushToken,
    });

    if (!device) {
      return {
        success: false,
        device: { found: false },
        sunset: { fetched: false, error: "Device not found" },
        notification: { wouldSend: false, reason: "Device not registered in database" },
      };
    }

    const deviceInfo = {
      found: true,
      notifyMorning: device.notifyMorning,
      notifyHourBefore: device.notifyHourBefore,
      minQuality: device.minQuality,
      latitude: device.latitude,
      longitude: device.longitude,
      timezone: device.timezone,
    };

    // Fetch sunset quality
    const dateStr = formatDateForTimezone(new Date(), device.timezone);
    let quality: SunsetQuality | null;
    let fetchError: string | undefined;

    if (isDemoMode) {
      quality = generateMockSunset(device.latitude, device.timezone);
    } else {
      const result = await fetchSunsetQuality(device.latitude, device.longitude, apiKey!, dateStr);
      if (result.success) {
        quality = result.data;
      } else {
        quality = null;
        fetchError = result.error;
      }
    }

    if (!quality) {
      return {
        success: true,
        device: deviceInfo,
        sunset: { fetched: false, error: fetchError || "Unknown error fetching sunset data" },
        notification: { wouldSend: false, reason: "No sunset data available from API" },
      };
    }

    const sunsetInfo = {
      fetched: true,
      quality: quality.quality,
      qualityPercent: quality.qualityPercent,
      sunsetTime: quality.sunsetTime,
      isDemo: isDemoMode || quality.isDemo,
    };

    // Check threshold
    const threshold = QUALITY_THRESHOLD[device.minQuality];
    const meetsThreshold = quality.qualityPercent >= threshold;

    if (!device.notifyMorning) {
      return {
        success: true,
        device: deviceInfo,
        sunset: sunsetInfo,
        notification: {
          wouldSend: false,
          reason: "Morning notifications are disabled in settings",
          threshold,
        },
      };
    }

    if (!meetsThreshold) {
      return {
        success: true,
        device: deviceInfo,
        sunset: sunsetInfo,
        notification: {
          wouldSend: false,
          reason: `Quality ${quality.qualityPercent}% is below your "${device.minQuality}" threshold (${threshold}%)`,
          threshold,
        },
      };
    }

    return {
      success: true,
      device: deviceInfo,
      sunset: sunsetInfo,
      notification: {
        wouldSend: true,
        reason: `Quality ${quality.qualityPercent}% meets "${device.minQuality}" threshold (${threshold}%)`,
        threshold,
      },
    };
  },
});

export const getDeviceByToken = internalQuery({
  args: { pushToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_push_token", (q) => q.eq("pushToken", args.pushToken))
      .first();
  },
});

export const getRecentNotifications = internalQuery({
  args: { deviceId: v.id("devices"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(args.limit ?? 10);
    return notifications;
  },
});

export const hasMorningNotificationToday = internalQuery({
  args: { deviceId: v.id("devices"), timezone: v.string() },
  handler: async (ctx, args) => {
    // Get today's date in the device's timezone
    const now = new Date();
    let todayStart: number;
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: args.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const todayStr = formatter.format(now);
      // Parse as start of day in UTC (good enough for dedup purposes)
      todayStart = new Date(todayStr + "T00:00:00Z").getTime();
    } catch {
      // Fallback: use UTC date
      todayStart = new Date(now.toISOString().split("T")[0] + "T00:00:00Z").getTime();
    }

    // Check if any morning notification was sent today
    const recentNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(5);

    return recentNotifications.some(
      (n) => n.type === "morning" && n.sentAt >= todayStart
    );
  },
});

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run at 11:00 AM UTC every day
// Users in different timezones will get notifications at different local times
// For a production app, you'd want to batch by timezone
crons.daily(
  "morning sunset check",
  { hourUTC: 11, minuteUTC: 0 },
  internal.sunsets.checkMorningSunsets
);

// Check for due reminders every 5 minutes
crons.interval(
  "send due reminders",
  { minutes: 5 },
  internal.sunsets.sendDueReminders
);

export default crons;

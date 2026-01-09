import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every hour to check for devices where it's currently 11 AM local time
// This ensures users get notifications at 11 AM in their timezone
crons.interval(
  "morning sunset check",
  { hours: 1 },
  internal.sunsets.checkMorningSunsets
);

// Check for due reminders every 5 minutes
crons.interval(
  "send due reminders",
  { minutes: 5 },
  internal.sunsets.sendDueReminders
);

export default crons;

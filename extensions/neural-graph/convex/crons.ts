import { cronJobs } from "convex/server";

// ---------------------------------------------------------------------------
// Scheduled evolution cycles
// ---------------------------------------------------------------------------

const crons = cronJobs();

// Evolution cycle runs every 15 minutes
// The actual evolution logic is triggered via the Node.js backend service,
// which calls Convex mutations. This cron is a heartbeat marker.
// (Convex crons can only call Convex functions, so the heavy lifting
//  happens in the extension's background service via HTTP.)

export default crons;

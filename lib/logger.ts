import { randomUUID } from "crypto";

export const LOG_LEVEL = (process.env.LOG_LEVEL ?? "info").toLowerCase();

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const current = LEVEL_PRIORITY[LOG_LEVEL as LogLevel] ?? 1;
  const message = LEVEL_PRIORITY[level];
  return message >= current;
}

export interface LogContext {
  requestId?: string;
  workspaceId?: string;
  syncId?: string;
  [key: string]: unknown;
}

export function createRequestId(): string {
  return randomUUID();
}

export function getLogger(requestId?: string) {
  const baseContext: LogContext = requestId ? { requestId } : {};

  return {
    debug: (message: string, context?: LogContext) => {
      if (shouldLog("debug")) {
        console.debug(
          JSON.stringify({
            level: "debug",
            message,
            ...baseContext,
            ...context,
            timestamp: new Date().toISOString(),
          })
        );
      }
    },
    info: (message: string, context?: LogContext) => {
      if (shouldLog("info")) {
        console.info(
          JSON.stringify({
            level: "info",
            message,
            ...baseContext,
            ...context,
            timestamp: new Date().toISOString(),
          })
        );
      }
    },
    warn: (message: string, context?: LogContext) => {
      if (shouldLog("warn")) {
        console.warn(
          JSON.stringify({
            level: "warn",
            message,
            ...baseContext,
            ...context,
            timestamp: new Date().toISOString(),
          })
        );
      }
    },
    error: (message: string, context?: LogContext) => {
      if (shouldLog("error")) {
        console.error(
          JSON.stringify({
            level: "error",
            message,
            ...baseContext,
            ...context,
            timestamp: new Date().toISOString(),
          })
        );
      }
    },
  };
}

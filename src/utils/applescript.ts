import { spawnSync } from "child_process";
import type { AppleScriptResult } from "@/types.js";

/**
 * Execute AppleScript without passing the script through a shell.
 * This avoids shell quoting/injection problems when note content contains
 * apostrophes, quotes, newlines, or other user-controlled text.
 */
export function runAppleScript(script: string): AppleScriptResult {
  const result = spawnSync("osascript", ["-e", script.trim()], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.error) {
    return { success: false, output: "", error: result.error.message };
  }

  if (result.status !== 0) {
    return {
      success: false,
      output: "",
      error: (result.stderr || "AppleScript execution failed").trim()
    };
  }

  return { success: true, output: (result.stdout || "").trim() };
}

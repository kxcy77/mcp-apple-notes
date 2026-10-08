import type { Note } from "@/types.js";
import { runAppleScript } from "@/utils/applescript.js";

const ICLOUD_ACCOUNT = "iCloud";
const RESULT_SEPARATOR = String.fromCharCode(30);

const appleScriptString = (value: string): string =>
  '"' +
  value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n") +
  '"';

const htmlBody = (content: string): string =>
  content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>")
    .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");

const decodeBody = (content: string): string =>
  content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");

const normalizeTags = (tags: string[]): string[] =>
  [...new Set(tags.map(tag => tag.trim().replace(/^#/, "")).filter(Boolean))];

export class AppleNotesManager {
  private noteByTitle(title: string): string {
    return `tell application "Notes"
  tell account ${appleScriptString(ICLOUD_ACCOUNT)}
    get body of note ${appleScriptString(title)}
  end tell
end tell`;
  }

  createNote(title: string, content: string, tags: string[] = [], folder?: string): Note | null {
    const body = htmlBody(content);
    const location = folder
      ? `make new note at folder ${appleScriptString(folder)} with properties {name:${appleScriptString(title)}, body:${appleScriptString(body)}}`
      : `make new note with properties {name:${appleScriptString(title)}, body:${appleScriptString(body)}}`;

    const script = `tell application "Notes"
  tell account ${appleScriptString(ICLOUD_ACCOUNT)}
    ${location}
  end tell
end tell`;

    const result = runAppleScript(script);
    if (!result.success) return null;

    const now = new Date();
    return {
      id: this.stableId(title),
      title,
      content,
      tags: normalizeTags(tags),
      folder,
      created: now,
      modified: now
    };
  }

  searchNotes(query: string, folder?: string, limit = 25): Note[] {
    const q = query.toLowerCase();
    const folderFilter = folder
      ? `if name of targetFolder is ${appleScriptString(folder)} then`
      : "";

    const script = `tell application "Notes"
  tell account ${appleScriptString(ICLOUD_ACCOUNT)}
    set outputText to ""
    repeat with n in notes
      set noteName to name of n
      set noteBody to body of n
      set targetFolder to container of n
      ${folderFilter}
        if ((noteName as text) contains ${appleScriptString(query)}) or ((noteBody as text) contains ${appleScriptString(query)}) then
          set outputText to outputText & noteName & (ASCII character 30)
        end if
      ${folder ? "end if" : ""}
    end repeat
    return outputText
  end tell
end tell`;

    const result = runAppleScript(script);
    if (!result.success) return [];

    return result.output
      .split(RESULT_SEPARATOR)
      .map(title => title.trim())
      .filter(Boolean)
      .filter(title => title.toLowerCase().includes(q) || q.length > 0)
      .slice(0, limit)
      .map(title => ({
        id: this.stableId(title),
        title,
        content: "",
        tags: [],
        folder,
        created: new Date(0),
        modified: new Date()
      }));
  }

  getNoteContent(title: string): string {
    const result = runAppleScript(this.noteByTitle(title));
    return result.success ? decodeBody(result.output) : "";
  }

  updateNote(title: string, content: string): boolean {
    const script = `tell application "Notes"
  tell account ${appleScriptString(ICLOUD_ACCOUNT)}
    set body of note ${appleScriptString(title)} to ${appleScriptString(htmlBody(content))}
  end tell
end tell`;
    return runAppleScript(script).success;
  }

  appendNote(title: string, content: string): boolean {
    const current = this.getNoteContent(title);
    if (!current) return false;
    const separator = current.endsWith("\n") ? "" : "\n";
    return this.updateNote(title, current + separator + content);
  }

  deleteNote(title: string): boolean {
    const script = `tell application "Notes"
  tell account ${appleScriptString(ICLOUD_ACCOUNT)}
    delete note ${appleScriptString(title)}
  end tell
end tell`;
    return runAppleScript(script).success;
  }

  private stableId(title: string): string {
    let hash = 2166136261;
    for (const char of title) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }
}

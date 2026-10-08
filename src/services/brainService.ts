import { AppleNotesManager } from "@/services/appleNotesManager.js";

export interface BrainMatch {
  id: string;
  title: string;
  folder?: string;
  snippet: string;
  score: number;
  reason: string;
}

/**
 * BrainService adds knowledge-management rules above raw Apple Notes:
 * search first, avoid duplicate entries, and make updates explicit.
 */
const normalizeTags = (tags: string[] = []): string[] =>
  [...new Set(tags.map(tag => tag.trim().replace(/^#/, "")).filter(Boolean))];

export const brainTemplate = (
  type: string,
  content: string,
  folder: string,
  tags: string[] = [],
  status = "Active"
): string => {
  const tagLine = normalizeTags(tags).map(tag => `#${tag}`).join(" ");
  return [
    `Type: ${type}`,
    `Folder: ${folder}`,
    `Status: ${status}`,
    tagLine ? `Tags: ${tagLine}` : "",
    "",
    content.trim()
  ].filter(Boolean).join("\n");
};

export class BrainService {
  constructor(private readonly notes: AppleNotesManager) {}

  findRelated(query: string, folder?: string, limit = 10): BrainMatch[] {
    const notes = this.notes.searchNotes(query, folder, limit);
    const terms = this.tokens(query);

    return notes.map(note => {
      const titleTerms = this.tokens(note.title);
      const overlap = terms.filter(term => titleTerms.includes(term)).length;
      const score = terms.length ? overlap / terms.length : 0;
      return {
        id: note.id,
        title: note.title,
        folder: note.folder,
        snippet: note.content.slice(0, 240).replace(/\\s+/g, " ").trim(),
        score,
        reason: score >= 0.75 ? "strong title match" : score >= 0.4 ? "partial title match" : "search match"
      };
    }).sort((a, b) => b.score - a.score);
  }

  createIfNew(title: string, content: string, folder: string, tags: string[] = []):
    { action: "created" | "duplicate" | "failed"; title: string; matches: BrainMatch[] } {
    const exact = this.notes.searchNotes(title, folder, 10)
      .find(note => note.title.toLowerCase() === title.toLowerCase());

    if (exact) {
      return { action: "duplicate", title: exact.title, matches: [{ id: exact.id, title: exact.title, folder: exact.folder, snippet: exact.content.slice(0, 240).replace(/\\s+/g, " ").trim(), score: 1, reason: "exact title already exists" }] };
    }

    const related = this.findRelated(title, folder, 5);
    if (related.some(match => match.score >= 0.75)) {
      return { action: "duplicate", title, matches: related };
    }

    const created = this.notes.createNote(title, content, tags, folder);
    return {
      action: created ? "created" : "failed",
      title,
      matches: related
    };
  }

  updateEntryById(
    id: string,
    content: string,
    metadata?: { type?: string; folder?: string; tags?: string[]; status?: string }
  ): boolean {
    const existing = this.notes.getNoteContentById(id);
    if (!existing) return false;

    const lines = existing.split("\n");
    const header = new Map<string, string>();
    let bodyStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(Type|Folder|Status|Tags):\\s*(.*)$/);
      if (!match) {
        bodyStart = lines[i].trim() === "" ? i + 1 : i;
        break;
      }
      header.set(match[1], match[2]);
    }

    const type = metadata?.type ?? header.get("Type") ?? "life";
    const folder = metadata?.folder ?? header.get("Folder") ?? "01 - LIFE";
    const status = metadata?.status ?? header.get("Status") ?? "Active";
    const tags = metadata?.tags ?? (header.get("Tags") ?? "").split(/\\s+/).filter(Boolean);

    return this.notes.updateNoteById(id, brainTemplate(type, content, folder, tags, status));
  }

  upsert(title: string, content: string):
    { action: "updated" | "created" | "failed"; title: string } {
    const exact = this.notes.searchNotes(title, undefined, 10)
      .find(note => note.title.toLowerCase() === title.toLowerCase());

    if (exact) {
      return {
        action: this.notes.updateNoteById(exact.id, content) ? "updated" : "failed",
        title: exact.title
      };
    }

    const created = this.notes.createNote(title, content);
    return { action: created ? "created" : "failed", title };
  }

  private tokens(value: string): string[] {
    return [...new Set(
      value.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter(term => term.length >= 3)
    )];
  }
}

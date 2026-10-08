import type { Note } from "@/types.js";
import { AppleNotesManager } from "@/services/appleNotesManager.js";

export interface BrainMatch {
  title: string;
  score: number;
  reason: string;
}

/**
 * BrainService adds knowledge-management rules above raw Apple Notes:
 * search first, avoid duplicate entries, and make updates explicit.
 */
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
        title: note.title,
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
      return { action: "duplicate", title: exact.title, matches: [{ title: exact.title, score: 1, reason: "exact title already exists" }] };
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

  upsert(title: string, content: string):
    { action: "updated" | "created" | "failed"; title: string } {
    const exact = this.notes.searchNotes(title, undefined, 10)
      .find(note => note.title.toLowerCase() === title.toLowerCase());

    if (exact) {
      return {
        action: this.notes.updateNote(exact.title, content) ? "updated" : "failed",
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

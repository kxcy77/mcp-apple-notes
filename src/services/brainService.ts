import { AppleNotesManager } from "@/services/appleNotesManager.js";

export interface BrainMatch {
  id: string;
  title: string;
  folder?: string;
  snippet: string;
  score: number;
  reason: string;
}

const normalizeTags = (tags: string[] = []): string[] =>
  [...new Set(tags.map(tag => tag.trim().replace(/^#/, "")).filter(Boolean))];

const snippet = (content: string): string =>
  content.replace(/\s+/g, " ").trim().slice(0, 240);

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
    const notes = this.notes.searchNotes(query, folder, Math.max(limit * 3, 25));
    const terms = this.tokens(query);

    return notes.map(note => {
      const titleTerms = this.tokens(note.title);
      const contentTerms = this.tokens(note.content);
      const body = note.content.toLowerCase();
      const folderText = (note.folder ?? "").toLowerCase();
      const tagLine = (this.metadataValue(note.content, "Tags") ?? "").toLowerCase();
      const exactPhrase = query.trim().length >= 3 && body.includes(query.trim().toLowerCase());

      const titleOverlap = this.overlap(terms, titleTerms);
      const contentOverlap = this.overlap(terms, contentTerms);
      const tagOverlap = this.overlap(terms, this.tokens(tagLine));
      const folderOverlap = this.overlap(terms, this.tokens(folderText));

      const score = Math.min(
        1,
        titleOverlap * 0.40 +
        contentOverlap * 0.35 +
        tagOverlap * 0.15 +
        folderOverlap * 0.10 +
        (exactPhrase ? 0.20 : 0)
      );

      const reason = exactPhrase
        ? "exact phrase in content"
        : titleOverlap >= 0.75
          ? "strong title match"
          : tagOverlap > 0
            ? "tag match"
            : contentOverlap >= 0.5
              ? "strong content match"
              : folderOverlap > 0
                ? "folder match"
                : "related search match";

      return {
        id: note.id,
        title: note.title,
        folder: note.folder,
        snippet: snippet(note.content),
        score,
        reason
      };
    })
      .filter(match => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  createIfNew(
    title: string,
    content: string,
    folder: string,
    tags: string[] = []
  ): { action: "created" | "duplicate" | "failed"; title: string; matches: BrainMatch[] } {
    const exact = this.notes.searchNotes(title, folder, 25)
      .find(note => note.title.toLowerCase() === title.toLowerCase());

    if (exact) {
      return {
        action: "duplicate",
        title: exact.title,
        matches: [{
          id: exact.id,
          title: exact.title,
          folder: exact.folder,
          snippet: snippet(exact.content),
          score: 1,
          reason: "exact title already exists"
        }]
      };
    }

    const related = this.findRelated(title, folder, 5);
    if (related.some(match => match.score >= 0.75)) {
      return { action: "duplicate", title, matches: related };
    }

    const created = this.notes.createNote(title, brainTemplate("life", content, folder, tags), tags, folder);
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

    const type = metadata?.type ?? this.metadataValue(existing, "Type") ?? "life";
    const folder = metadata?.folder ?? this.metadataValue(existing, "Folder") ?? "01 - LIFE";
    const status = metadata?.status ?? this.metadataValue(existing, "Status") ?? "Active";
    const existingTags = this.metadataValue(existing, "Tags") ?? "";
    const tags = metadata?.tags ?? existingTags.split(/\s+/).map(tag => tag.replace(/^#/, "")).filter(Boolean);

    return this.notes.updateNoteById(id, brainTemplate(type, content, folder, tags, status));
  }

  upsert(title: string, content: string):
    { action: "updated" | "created" | "failed"; title: string } {
    const exact = this.notes.searchNotes(title, undefined, 25)
      .find(note => note.title.toLowerCase() === title.toLowerCase());

    if (exact) {
      return {
        action: this.updateEntryById(exact.id, content) ? "updated" : "failed",
        title: exact.title
      };
    }

    const created = this.notes.createNote(title, brainTemplate("life", content, "01 - LIFE"), [], "01 - LIFE");
    return { action: created ? "created" : "failed", title };
  }

  private metadataValue(content: string, key: string): string | undefined {
    const match = content.match(new RegExp(`^${key}:\\s*(.*)$`, "mi"));
    return match?.[1]?.trim();
  }

  private overlap(queryTerms: string[], fieldTerms: string[]): number {
    if (!queryTerms.length) return 0;
    const field = new Set(fieldTerms);
    return queryTerms.filter(term => field.has(term)).length / queryTerms.length;
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

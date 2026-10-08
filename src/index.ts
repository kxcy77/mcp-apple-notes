import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AppleNotesManager } from "@/services/appleNotesManager.js";
import { BrainService } from "@/services/brainService.js";

const server = new McpServer({
  name: "kagiso-ai-brain",
  version: "1.0.0",
  description: "Personal AI Brain backed by Apple Notes"
});

const notes = new AppleNotesManager();
const brain = new BrainService(notes);

const folders = [
  "00 - CORE", "01 - LIFE", "02 - GOALS", "03 - PROJECTS",
  "04 - WORK", "05 - CHURCH", "06 - STUDY", "07 - RELATIONSHIPS",
  "08 - FINANCE", "09 - IDEAS", "10 - DECISIONS", "11 - KNOWLEDGE", "99 - ARCHIVE"
];

const textResult = (text: string, isError = false) => ({
  content: [{ type: "text" as const, text }],
  ...(isError ? { isError: true } : {})
});

server.tool(
  "brain-search",
  {
    query: z.string().min(1),
    folder: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional()
  },
  async ({ query, folder, limit = 25 }) => {
    const found = notes.searchNotes(query, folder, limit);
    return textResult(found.length
      ? found.map(n => `• ${n.title}${n.folder ? ` — ${n.folder}` : ""}`).join("\n")
      : "No Brain entries found.");
  }
);

server.tool(
  "brain-read",
  { title: z.string().min(1) },
  async ({ title }) => {
    const content = notes.getNoteContent(title);
    return content ? textResult(content) : textResult(`Brain entry not found: "${title}"`, true);
  }
);

server.tool(
  "brain-create",
  {
    title: z.string().min(1),
    content: z.string().min(1),
    folder: z.enum(folders as [string, ...string[]]).default("01 - LIFE"),
    tags: z.array(z.string()).optional(),
    status: z.string().optional()
  },
  async ({ title, content, folder, tags = [], status }) => {
    const fullContent = status ? `Status: ${status}\n\n${content}` : content;
    const created = notes.createNote(title, fullContent, tags, folder);
    return created
      ? textResult(`Brain entry created: "${title}"`)
      : textResult("Failed to create Brain entry. Check Apple Notes permissions/configuration.", true);
  }
);

server.tool(
  "brain-update",
  {
    title: z.string().min(1),
    content: z.string().min(1)
  },
  async ({ title, content }) => {
    return notes.updateNote(title, content)
      ? textResult(`Brain entry updated: "${title}"`)
      : textResult(`Failed to update Brain entry: "${title}"`, true);
  }
);

server.tool(
  "brain-append",
  {
    title: z.string().min(1),
    content: z.string().min(1)
  },
  async ({ title, content }) => {
    return notes.appendNote(title, content)
      ? textResult(`Added to Brain entry: "${title}"`)
      : textResult(`Failed to append to Brain entry: "${title}"`, true);
  }
);

server.tool(
  "brain-delete",
  { title: z.string().min(1) },
  async ({ title }) => {
    return notes.deleteNote(title)
      ? textResult(`Brain entry deleted: "${title}"`)
      : textResult(`Failed to delete Brain entry: "${title}"`, true);
  }
);

server.tool(
  "brain-context-check",
  {
    contextPercent: z.number().min(0).max(100),
    threshold: z.number().min(1).max(100).default(30)
  },
  async ({ contextPercent, threshold }) => {
    const shouldCompact = contextPercent >= threshold;
    return textResult(JSON.stringify({
      contextPercent,
      threshold,
      shouldCompact,
      action: shouldCompact
        ? "Prepare a lossless context handoff and start a fresh thread if the client supports it."
        : "Continue the current thread."
    }, null, 2));
  }
);

server.tool(
  "brain-compact-context",
  {
    currentObjective: z.string(),
    currentState: z.string(),
    keyDecisions: z.array(z.string()).default([]),
    importantFacts: z.array(z.string()).default([]),
    preferences: z.array(z.string()).default([]),
    constraints: z.array(z.string()).default([]),
    problems: z.array(z.string()).default([]),
    attemptsAndResults: z.array(z.string()).default([]),
    reasoning: z.array(z.string()).default([]),
    openQuestions: z.array(z.string()).default([]),
    nextActions: z.array(z.string()).default([]),
    brainReferences: z.array(z.string()).default([])
  },
  async (input) => {
    const handoff = [
      "# THREAD CONTEXT HANDOFF",
      "",
      "## CURRENT OBJECTIVE", input.currentObjective,
      "",
      "## CURRENT STATE", input.currentState,
      "",
      "## KEY DECISIONS", ...input.keyDecisions.map(x => `- ${x}`),
      "",
      "## IMPORTANT FACTS", ...input.importantFacts.map(x => `- ${x}`),
      "",
      "## USER PREFERENCES", ...input.preferences.map(x => `- ${x}`),
      "",
      "## CONSTRAINTS", ...input.constraints.map(x => `- ${x}`),
      "",
      "## PROBLEMS", ...input.problems.map(x => `- ${x}`),
      "",
      "## ATTEMPTS + RESULTS", ...input.attemptsAndResults.map(x => `- ${x}`),
      "",
      "## REASONING / WHY", ...input.reasoning.map(x => `- ${x}`),
      "",
      "## OPEN QUESTIONS", ...input.openQuestions.map(x => `- ${x}`),
      "",
      "## NEXT ACTIONS", ...input.nextActions.map(x => `- ${x}`),
      "",
      "## BRAIN REFERENCES", ...input.brainReferences.map(x => `- ${x}`)
    ].join("\n");
    return textResult(handoff);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

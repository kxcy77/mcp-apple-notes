export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  folder?: string;
  created: Date;
  modified: Date;
}

export interface AppleScriptResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface BrainEntry {
  title: string;
  content: string;
  folder: string;
  tags: string[];
  status?: string;
}

export interface CreateNoteParams {
  title: string;
  content: string;
  tags?: string[];
  folder?: string;
}

export interface SearchParams {
  query: string;
  folder?: string;
  limit?: number;
}

export interface GetNoteParams {
  title: string;
}

export interface UpdateNoteParams {
  title: string;
  content: string;
}

export interface AppendNoteParams {
  title: string;
  content: string;
}

export interface DeleteNoteParams {
  title: string;
}

export interface BrainCreateParams {
  title: string;
  content: string;
  folder?: string;
  tags?: string[];
  status?: string;
}

export interface BrainUpdateParams {
  title: string;
  content: string;
  folder?: string;
  tags?: string[];
  status?: string;
}

export interface BrainSearchParams {
  query: string;
  folder?: string;
  limit?: number;
}

export interface BrainAppendParams {
  title: string;
  content: string;
}

export interface ContextCompactionParams {
  context: string;
  contextPercent?: number;
}

export interface CompactionDecisionParams {
  contextPercent: number;
  threshold?: number;
}

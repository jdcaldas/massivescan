export interface ProjectMeta {
  id: string;           // nanoid or UUID
  name: string;         // "Animals from London Zoo"
  client?: string;      // optional client name
  description?: string;
  createdAt: string;    // ISO timestamp
  updatedAt: string;
  status: 'active' | 'archived';
}

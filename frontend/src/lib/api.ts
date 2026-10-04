/**
 * DocuMind Full-Stack API Client & Storage Handlers
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// --- Token Management ---
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("documind_token");
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("documind_token", token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("documind_token");
}

// --- Generic Fetch Helper ---
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData uploads (browser handles boundary automatically)
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuthToken();
    if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    let errorDetail = `Request failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) {
    return null as unknown as T;
  }

  return await res.json();
}

// --- Interfaces ---
export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type DocumentStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

export interface DocumentItem {
  id: string;
  user_id: string;
  title: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  status: DocumentStatus;
  error_message?: string;
  page_count: number;
  chunk_count: number;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  page_number?: number;
  section_title?: string;
  text_content: string;
  chunk_metadata: Record<string, unknown>;
}

export interface Citation {
  document_id: string;
  document_title: string;
  page_number?: number;
  section_title?: string;
  excerpt: string;
  score?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  selected_document_ids: string[];
  messages: Message[];
  created_at: string;
  updated_at?: string;
}

// --- API Methods ---

export async function checkBackendHealth(): Promise<HealthCheckResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("Backend offline");
  return res.json();
}

// Auth
export async function registerUser(email: string, password: string, fullName?: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  setAuthToken(data.access_token);
  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.access_token);
  return data;
}

export async function getCurrentUser(): Promise<User> {
  return await apiFetch<User>("/auth/me");
}

// Documents
export async function uploadDocumentFile(file: File): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append("file", file);
  return await apiFetch<DocumentItem>("/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getDocumentsList(): Promise<DocumentItem[]> {
  return await apiFetch<DocumentItem[]>("/documents");
}

export async function getDocumentStatus(id: string): Promise<{ status: DocumentStatus; page_count: number; chunk_count: number; error_message?: string }> {
  return await apiFetch<{ status: DocumentStatus; page_count: number; chunk_count: number; error_message?: string }>(`/documents/${id}/status`);
}

export async function getDocumentChunks(id: string): Promise<DocumentChunk[]> {
  return await apiFetch<DocumentChunk[]>(`/documents/${id}/chunks`);
}

export async function deleteDocumentItem(id: string): Promise<void> {
  return await apiFetch<void>(`/documents/${id}`, { method: "DELETE" });
}

// Chat & RAG
export async function sendChatMessage(content: string, conversationId?: string, documentIds?: string[]): Promise<Message> {
  return await apiFetch<Message>("/chat", {
    method: "POST",
    body: JSON.stringify({
      content,
      conversation_id: conversationId,
      document_ids: documentIds,
    }),
  });
}

export async function getConversationsList(): Promise<Conversation[]> {
  return await apiFetch<Conversation[]>("/chat/conversations");
}

export async function getConversationDetail(id: string): Promise<Conversation> {
  return await apiFetch<Conversation>(`/chat/conversations/${id}`);
}

export async function deleteConversationItem(id: string): Promise<void> {
  return await apiFetch<void>(`/chat/conversations/${id}`, { method: "DELETE" });
}

export async function compareDocumentsList(documentIds: string[], query?: string): Promise<{ answer: string; citations: Citation[] }> {
  return await apiFetch<{ answer: string; citations: Citation[] }>("/chat/compare", {
    method: "POST",
    body: JSON.stringify({
      document_ids: documentIds,
      query,
    }),
  });
}

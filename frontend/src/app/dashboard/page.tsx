"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  UploadCloud,
  Send,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Layers,
  Sparkles,
  BookOpen,
  ChevronRight,
  MessageSquare,
  CheckSquare,
  Square,
  X,
  Copy,
  Check,
  Eye
} from "lucide-react";
import {
  getCurrentUser,
  getDocumentsList,
  getDocumentChunks,
  uploadDocumentFile,
  deleteDocumentItem,
  sendChatMessage,
  compareDocumentsList,
  clearAuthToken,
  User,
  DocumentItem,
  DocumentChunk,
  Message,
  Citation
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  
  // Modals
  const [comparisonModal, setComparisonModal] = useState<{ open: boolean; answer: string; citations: Citation[] }>({
    open: false,
    answer: "",
    citations: []
  });
  const [activeCitationModal, setActiveCitationModal] = useState<Citation | null>(null);
  const [inspectDocModal, setInspectDocModal] = useState<{ doc: DocumentItem | null; chunks: DocumentChunk[]; loading: boolean }>({
    doc: null,
    chunks: [],
    loading: false
  });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load User & Documents
  useEffect(() => {
    async function initDashboard() {
      try {
        const u = await getCurrentUser();
        setUser(u);
        const docs = await getDocumentsList();
        setDocuments(docs);
      } catch (err: unknown) {
        console.error("Dashboard init error:", err);
        router.push("/login");
      }
    }
    initDashboard();
  }, [router]);

  // Polling for document processing status
  useEffect(() => {
    const hasPendingDocs = documents.some(
      (d) => d.status === "UPLOADING" || d.status === "PROCESSING"
    );
    if (!hasPendingDocs) return;

    const interval = setInterval(async () => {
      try {
        const refreshedDocs = await getDocumentsList();
        setDocuments(refreshedDocs);
      } catch (err) {
        console.error("Failed to poll documents:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [documents]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);

    for (let i = 0; i < files.length; i++) {
      try {
        const newDoc = await uploadDocumentFile(files[i]);
        setDocuments((prev) => [newDoc, ...prev]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setErrorMessage(`Upload error for ${files[i].name}: ${msg}`);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeleteDocument(docId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await deleteDocumentItem(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setErrorMessage(msg);
    }
  }

  async function handleInspectDocument(doc: DocumentItem, e: React.MouseEvent) {
    e.stopPropagation();
    setInspectDocModal({ doc, chunks: [], loading: true });
    try {
      const chunks = await getDocumentChunks(doc.id);
      setInspectDocModal({ doc, chunks, loading: false });
    } catch {
      setInspectDocModal({ doc, chunks: [], loading: false });
    }
  }

  function toggleDocSelection(docId: string) {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }

  function selectAllDocs() {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map((d) => d.id));
    }
  }

  async function handleSendMessage(customPrompt?: string) {
    const text = customPrompt || inputValue;
    if (!text.trim() || isSending) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: "current",
      role: "user",
      content: text,
      citations: [],
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customPrompt) setInputValue("");
    setIsSending(true);
    setErrorMessage(null);

    try {
      const assistantMessage = await sendChatMessage(
        text,
        undefined,
        selectedDocIds.length > 0 ? selectedDocIds : undefined
      );
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to retrieve AI answer.";
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  }

  async function handleCompareDocuments() {
    if (selectedDocIds.length < 2) {
      setErrorMessage("Please select at least 2 documents to compare.");
      return;
    }

    setIsComparing(true);
    setErrorMessage(null);

    try {
      const res = await compareDocumentsList(
        selectedDocIds,
        "Compare key terms, obligations, termination clauses, and financial commitments across these documents."
      );
      setComparisonModal({
        open: true,
        answer: res.answer,
        citations: res.citations
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Comparison failed.";
      setErrorMessage(msg);
    } finally {
      setIsComparing(false);
    }
  }

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function handleLogout() {
    clearAuthToken();
    router.push("/login");
  }

  const promptSuggestions = [
    "Summarize the main obligations in these documents.",
    "Compare the termination clauses and notice periods.",
    "What are the payment and billing conditions?",
    "Identify any automatic renewal or indemnity terms."
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* LEFT SIDEBAR: Document Library */}
      <aside className="w-80 sm:w-96 flex flex-col border-r border-slate-800 bg-slate-900/40 backdrop-blur-sm shrink-0">
        {/* Workspace Brand */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">DocuMind</span>
          </Link>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Upload Zone */}
        <div className="p-4 border-b border-slate-800/80">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full border-2 border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-950/40 hover:bg-slate-900/60 rounded-xl p-4 flex flex-col items-center justify-center text-center transition group disabled:opacity-50"
          >
            <UploadCloud className="w-6 h-6 text-blue-400 group-hover:scale-110 transition duration-150 mb-1.5" />
            <span className="text-xs font-semibold text-slate-200">
              {isUploading ? "Uploading & Ingesting..." : "Upload Document(s)"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">PDF, DOCX, TXT, Images (OCR)</span>
          </button>
        </div>

        {/* Document Selection Controls */}
        <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <button
              onClick={selectAllDocs}
              className="flex items-center space-x-1 hover:text-slate-200 transition"
            >
              {selectedDocIds.length === documents.length && documents.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              <span>{selectedDocIds.length > 0 ? `${selectedDocIds.length} selected` : "Select All"}</span>
            </button>
          </div>

          {selectedDocIds.length >= 2 && (
            <button
              onClick={handleCompareDocuments}
              disabled={isComparing}
              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] shadow-sm flex items-center space-x-1 transition"
            >
              <Layers className="w-3 h-3" />
              <span>{isComparing ? "Comparing..." : "Compare"}</span>
            </button>
          )}
        </div>

        {/* Documents Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {documents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-medium text-slate-400">No documents yet</p>
              <p className="text-[11px] text-slate-500 mt-1">Upload files to start asking questions</p>
            </div>
          ) : (
            documents.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.id);
              return (
                <div
                  key={doc.id}
                  onClick={() => toggleDocSelection(doc.id)}
                  className={`p-3 rounded-xl border transition cursor-pointer select-none ${
                    isSelected
                      ? "bg-blue-950/30 border-blue-500/50 shadow-sm shadow-blue-500/10"
                      : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start space-x-2.5 min-w-0">
                      <div className="mt-0.5 text-slate-400">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-slate-200 truncate" title={doc.original_filename}>
                          {doc.original_filename}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1 text-[10px] text-slate-400">
                          <span className="uppercase font-mono">{doc.file_type}</span>
                          <span>•</span>
                          <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                          {doc.page_count > 0 && (
                            <>
                              <span>•</span>
                              <span>{doc.page_count} pg</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={(e) => handleInspectDocument(doc, e)}
                        title="Inspect extracted chunks"
                        className="text-slate-500 hover:text-blue-400 p-1 rounded transition opacity-70 hover:opacity-100"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDocument(doc.id, e)}
                        title="Delete document"
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition opacity-70 hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Status Indicator Chip */}
                  <div className="mt-2.5 flex items-center justify-between text-[10px]">
                    <div className="flex items-center space-x-1.5">
                      {doc.status === "READY" && (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Ready ({doc.chunk_count} chunks)</span>
                        </>
                      )}
                      {doc.status === "PROCESSING" && (
                        <>
                          <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                          <span className="text-amber-400 font-medium">Processing...</span>
                        </>
                      )}
                      {doc.status === "UPLOADING" && (
                        <>
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span className="text-blue-400 font-medium">Uploading...</span>
                        </>
                      )}
                      {doc.status === "FAILED" && (
                        <>
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span className="text-rose-400 font-medium truncate" title={doc.error_message}>
                            Failed
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 truncate">
            <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              {user?.full_name ? user.full_name.charAt(0) : "U"}
            </div>
            <span className="text-slate-300 truncate">{user?.email || "User"}</span>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN: AI Chat & Multi-Document RAG */}
      <main className="flex-1 flex flex-col h-full relative">
        {/* Chat Header */}
        <header className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Grounded Document Q&A</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {selectedDocIds.length === 0
                ? "Searching All Documents"
                : `Filtered to ${selectedDocIds.length} Document(s)`}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setMessages([])}
              className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 transition"
            >
              Clear Chat
            </button>
          </div>
        </header>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2.5 text-xs text-rose-400 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Ask anything about your documents</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                DocuMind extracts context with exact page citations, detects cross-contract differences, and answers questions with zero hallucinations.
              </p>

              {/* Prompt Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full text-left">
                {promptSuggestions.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="p-3 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition text-left flex items-start space-x-2 group"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-0.5 transition shrink-0 mt-0.5" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, mIdx) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  msg.role === "user" ? "ml-auto justify-end" : "mr-auto justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 mt-1 shadow-sm shadow-blue-500/20">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-4 text-sm leading-relaxed relative group ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 rounded-tr-none"
                      : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none"
                  }`}
                >
                  {/* Copy Button */}
                  <button
                    onClick={() => copyToClipboard(msg.content, mIdx)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                    title="Copy to clipboard"
                  >
                    {copiedIndex === mIdx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <div className="whitespace-pre-wrap pr-6">{msg.content}</div>

                  {/* Citations list */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                        <span>Sources & Citations:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((cite, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => setActiveCitationModal(cite)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500/50 text-[11px] text-blue-400 hover:text-blue-300 transition"
                          >
                            <span className="font-medium truncate max-w-[140px]">{cite.document_title}</span>
                            {cite.page_number && (
                              <span className="text-slate-400">pg. {cite.page_number}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-1">
                    <span className="text-xs font-bold">{user?.full_name ? user.full_name.charAt(0) : "U"}</span>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="max-w-4xl mx-auto relative flex items-center"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                documents.length === 0
                  ? "Upload a document first to start querying..."
                  : "Ask a question, request a summary, or compare clauses..."
              }
              disabled={isSending || documents.length === 0}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-5 pr-24 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-lg"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSending || documents.length === 0}
              className="absolute right-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-xs flex items-center space-x-1.5 transition shadow-md shadow-blue-600/20"
            >
              {isSending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* DOCUMENT INSPECTION MODAL */}
      {inspectDocModal.doc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl relative">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  {inspectDocModal.doc.original_filename}
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  Format: <span className="uppercase font-mono text-slate-200">{inspectDocModal.doc.file_type}</span> • Size: <span className="text-slate-200">{(inspectDocModal.doc.file_size / 1024).toFixed(1)} KB</span> • Pages: <span className="text-slate-200">{inspectDocModal.doc.page_count}</span>
                </div>
              </div>
              <button
                onClick={() => setInspectDocModal({ doc: null, chunks: [], loading: false })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Extracted Chunks & Embedding Vectors ({inspectDocModal.chunks.length})
              </h4>
              {inspectDocModal.loading ? (
                <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Loading extracted chunks...</span>
                </div>
              ) : inspectDocModal.chunks.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No indexed chunks found for this document.
                </div>
              ) : (
                inspectDocModal.chunks.map((chunk) => (
                  <div key={chunk.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-slate-400 text-[11px]">
                      <span className="font-mono text-blue-400">Chunk #{chunk.chunk_index + 1}</span>
                      <span>Page {chunk.page_number || 1}</span>
                    </div>
                    <p className="text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {chunk.text_content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                onClick={() => setInspectDocModal({ doc: null, chunks: [], loading: false })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CITATION DETAIL MODAL */}
      {activeCitationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setActiveCitationModal(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 text-blue-400 mb-3">
              <BookOpen className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Citation Reference</span>
            </div>

            <h3 className="text-base font-semibold text-white mb-1">
              {activeCitationModal.document_title}
            </h3>
            <div className="text-xs text-slate-400 mb-4">
              {activeCitationModal.page_number && `Page ${activeCitationModal.page_number}`}
              {activeCitationModal.section_title && ` • Section: ${activeCitationModal.section_title}`}
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-slate-300 leading-relaxed max-h-60 overflow-y-auto">
              &quot;{activeCitationModal.excerpt}&quot;
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setActiveCitationModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-DOCUMENT COMPARISON MODAL */}
      {comparisonModal.open && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl relative">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-400">
                <Layers className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Multi-Document Analysis & Comparison</h3>
              </div>
              <button
                onClick={() => setComparisonModal({ open: false, answer: "", citations: [] })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {comparisonModal.answer}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {comparisonModal.citations.length} sources analyzed
              </span>
              <button
                onClick={() => setComparisonModal({ open: false, answer: "", citations: [] })}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-md shadow-blue-600/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

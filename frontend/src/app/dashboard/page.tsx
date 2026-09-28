"use client";

import { useEffect, useState, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Menu, ChevronLeft, RefreshCw } from "lucide-react";

import {
  getCurrentUser,
  getDocumentsList,
  getDocumentStatus,
  getDocumentChunks,
  uploadDocumentFile,
  deleteDocumentItem,
  sendChatMessage,
  getConversationsList,
  getConversationDetail,
  deleteConversationItem,
  compareDocumentsList,
  clearAuthToken,
  getAuthToken,
  User as UserType,
  DocumentItem,
  DocumentChunk,
  Message,
  Citation,
  Conversation,
} from "@/lib/api";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { DocumentList } from "@/components/dashboard/DocumentList";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { UploadProgress, UploadItem } from "@/components/dashboard/UploadProgress";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { DocumentViewer } from "@/components/dashboard/DocumentViewer";
import { CitationModal } from "@/components/dashboard/CitationModal";
import { ComparisonView } from "@/components/dashboard/ComparisonView";
import { ErrorState } from "@/components/common/ErrorState";

export default function DashboardPage() {
  const router = useRouter();

  // Auth & Core Data
  const [user, setUser] = useState<UserType | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Documents State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");

  // Upload State
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Chat & Conversation State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  // UI Views & Modals
  const [activeView, setActiveView] = useState<"chat" | "documents">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal States
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [inspectModal, setInspectModal] = useState<{
    doc: DocumentItem | null;
    chunks: DocumentChunk[];
    loading: boolean;
  }>({ doc: null, chunks: [], loading: false });

  const [comparisonModal, setComparisonModal] = useState<{
    open: boolean;
    answer: string;
    citations: Citation[];
    loading: boolean;
  }>({ open: false, answer: "", citations: [], loading: false });

  // 1. Initial Load & Authentication Verification
  useEffect(() => {
    async function initDashboard() {
      const token = getAuthToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const [currentUser, docList, convList] = await Promise.all([
          getCurrentUser(),
          getDocumentsList(),
          getConversationsList().catch(() => [] as Conversation[]),
        ]);

        setUser(currentUser);
        setDocuments(docList);
        setConversations(convList);
        setIsAuthChecking(false);
      } catch (err) {
        console.error("Failed to initialize dashboard session:", err);
        clearAuthToken();
        router.push("/login");
      }
    }

    initDashboard();
  }, [router]);

  // 2. Targeted Document Processing Status Polling
  useEffect(() => {
    const pendingDocs = documents.filter(
      (d) => d.status === "UPLOADING" || d.status === "PROCESSING"
    );
    if (pendingDocs.length === 0) return;

    const interval = setInterval(async () => {
      try {
        let hasChanges = false;
        const updatedDocs = await Promise.all(
          documents.map(async (doc) => {
            if (doc.status === "UPLOADING" || doc.status === "PROCESSING") {
              try {
                const statusData = await getDocumentStatus(doc.id);
                if (statusData.status !== doc.status) {
                  hasChanges = true;
                  return {
                    ...doc,
                    status: statusData.status,
                    page_count: statusData.page_count,
                    chunk_count: statusData.chunk_count,
                    error_message: statusData.error_message,
                  };
                }
              } catch (e) {
                console.error(`Failed to poll status for doc ${doc.id}:`, e);
              }
            }
            return doc;
          })
        );

        if (hasChanges) {
          setDocuments(updatedDocs);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [documents]);

  // Document Upload Handlers (Supports Parallel Multi-File Ingestion)
  async function handleFilesSelected(files: FileList | File[]) {
    setIsUploading(true);
    setErrorMessage(null);

    const newUploads: UploadItem[] = Array.from(files).map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      progress: 10,
      status: "uploading",
    }));

    setUploadQueue((prev) => [...newUploads, ...prev]);

    // Process parallel uploads safely
    await Promise.all(
      newUploads.map(async (item) => {
        try {
          const doc = await uploadDocumentFile(item.file);
          setUploadQueue((prev) =>
            prev.map((q) =>
              q.id === item.id ? { ...q, progress: 100, status: "success" } : q
            )
          );
          setDocuments((prev) => [doc, ...prev]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed.";
          setUploadQueue((prev) =>
            prev.map((q) =>
              q.id === item.id ? { ...q, status: "error", error: msg } : q
            )
          );
          setErrorMessage(`Failed to upload ${item.file.name}: ${msg}`);
        }
      })
    );

    setIsUploading(false);
    // Clear completed upload toasts after 5 seconds
    setTimeout(() => {
      setUploadQueue((prev) => prev.filter((q) => q.status === "uploading"));
    }, 5000);
  }

  // Document Management Actions
  async function handleDeleteDocument(docId: string, e: MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    try {
      await deleteDocumentItem(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      setErrorMessage(msg);
    }
  }

  async function handleInspectDocument(doc: DocumentItem, e: MouseEvent) {
    e.stopPropagation();
    setInspectModal({ doc, chunks: [], loading: true });

    try {
      const chunks = await getDocumentChunks(doc.id);
      setInspectModal({ doc, chunks, loading: false });
    } catch (err) {
      console.error("Failed to load chunks:", err);
      setInspectModal({ doc, chunks: [], loading: false });
      setErrorMessage("Could not load document chunks.");
    }
  }

  function handleToggleDoc(docId: string) {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }

  function handleSelectAllDocs() {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map((d) => d.id));
    }
  }

  // Conversation Actions
  function handleNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setErrorMessage(null);
  }

  async function handleSelectConversation(convId: string) {
    if (convId === activeConversationId) return;
    setActiveConversationId(convId);
    setErrorMessage(null);

    try {
      const conv = await getConversationDetail(convId);
      setMessages(conv.messages || []);
      if (conv.selected_document_ids) {
        setSelectedDocIds(conv.selected_document_ids);
      }
    } catch (err) {
      console.error("Failed to fetch conversation:", err);
      setErrorMessage("Could not load selected conversation.");
    }
  }

  async function handleDeleteConversation(convId: string, e: MouseEvent) {
    e.stopPropagation();
    try {
      await deleteConversationItem(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      setErrorMessage("Could not delete conversation.");
    }
  }

  // Chat Query Submission
  async function handleSendMessage(customQuery?: string) {
    const query = customQuery ?? inputValue;
    if (!query.trim() || isSending) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId || "temp",
      role: "user",
      content: query,
      citations: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);
    setErrorMessage(null);

    try {
      const assistantMessage = await sendChatMessage(
        query,
        activeConversationId || undefined,
        selectedDocIds.length > 0 ? selectedDocIds : undefined
      );

      setMessages((prev) => [...prev, assistantMessage]);

      // If this was a new conversation, update activeConversationId and list
      if (!activeConversationId && assistantMessage.conversation_id) {
        setActiveConversationId(assistantMessage.conversation_id);
        getConversationsList()
          .then((list) => setConversations(list))
          .catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate answer.";
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  }

  // Multi-Document Comparison Action
  async function handleCompareDocuments() {
    if (selectedDocIds.length < 2) {
      setErrorMessage("Please select at least 2 documents to compare.");
      return;
    }

    setComparisonModal({
      open: true,
      answer: "",
      citations: [],
      loading: true,
    });
    setErrorMessage(null);

    try {
      const result = await compareDocumentsList(
        selectedDocIds,
        "Compare key terms, provisions, termination rules, and obligations across these documents."
      );

      setComparisonModal({
        open: true,
        answer: result.answer,
        citations: result.citations,
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Comparison failed.";
      setErrorMessage(msg);
      setComparisonModal({
        open: false,
        answer: "",
        citations: [],
        loading: false,
      });
    }
  }

  function handleLogout() {
    clearAuthToken();
    router.push("/login");
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs text-[#777]">
          <RefreshCw className="h-4 w-4 animate-spin text-[#171717]" />
          <span>Loading DocuMind Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white text-[#2f2f2f] font-sans selection:bg-[#171717] selection:text-white">
      {/* 1. Sidebar Component */}
      <Sidebar
        isOpen={sidebarOpen}
        user={user}
        documents={documents}
        conversations={conversations}
        activeConversationId={activeConversationId}
        activeView={activeView}
        selectedDocIds={selectedDocIds}
        searchValue={searchValue}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onViewChange={setActiveView}
        onSearchChange={setSearchValue}
        onToggleDoc={handleToggleDoc}
        onInspectDoc={handleInspectDocument}
        onDeleteDoc={handleDeleteDocument}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onLogout={handleLogout}
      />

      {/* 2. Main Workspace */}
      <main className="flex min-w-0 flex-1 flex-col bg-white">
        {/* Top App Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.08] px-4 sm:px-6 bg-white z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="rounded-lg p-1.5 text-[#777] hover:bg-[#f2f2f2] hover:text-[#171717] transition"
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>

            <span className="text-sm font-semibold text-[#171717]">
              {activeView === "chat" ? "Document Intelligence Chat" : "Document Management"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeView === "chat" ? (
              <button
                type="button"
                onClick={() => setActiveView("documents")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-medium text-[#444] shadow-xs hover:bg-[#f5f5f5] transition"
              >
                <span>Manage Docs ({documents.length})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveView("chat")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#000] transition"
              >
                <span>Open Chat</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="px-4 py-2 bg-white">
            <ErrorState
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
            />
          </div>
        )}

        {/* View Switch */}
        {activeView === "documents" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#171717]">
                Document Repository
              </h1>
              <p className="mt-1 text-xs text-[#777]">
                Upload and index contracts, reports, and scans for AI semantic grounding.
              </p>
            </div>

            {/* Upload Zone */}
            <UploadZone
              onFilesSelected={handleFilesSelected}
              isUploading={isUploading}
            />

            {/* Upload Progress Status */}
            <UploadProgress items={uploadQueue} />

            {/* Document List */}
            <DocumentList
              documents={documents.filter((d) =>
                d.original_filename.toLowerCase().includes(searchValue.toLowerCase())
              )}
              selectedDocIds={selectedDocIds}
              isComparing={comparisonModal.loading}
              onSelect={handleToggleDoc}
              onSelectAll={handleSelectAllDocs}
              onCompare={handleCompareDocuments}
              onInspect={handleInspectDocument}
              onDelete={handleDeleteDocument}
            />
          </div>
        ) : (
          <ChatPanel
            documents={documents}
            selectedDocIds={selectedDocIds}
            messages={messages}
            inputValue={inputValue}
            isSending={isSending}
            user={user}
            onInputChange={setInputValue}
            onSend={handleSendMessage}
            onCitationClick={setActiveCitation}
            onRemoveSelectedDoc={handleToggleDoc}
            onUploadClick={() => setActiveView("documents")}
          />
        )}
      </main>

      {/* 3. Document Inspector Modal */}
      <DocumentViewer
        document={inspectModal.doc}
        chunks={inspectModal.chunks}
        loading={inspectModal.loading}
        onClose={() => setInspectModal({ doc: null, chunks: [], loading: false })}
      />

      {/* 4. Citation Excerpt Modal */}
      <CitationModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />

      {/* 5. Comparison Modal */}
      <ComparisonView
        open={comparisonModal.open}
        answer={comparisonModal.answer}
        citations={comparisonModal.citations}
        onClose={() =>
          setComparisonModal({
            open: false,
            answer: "",
            citations: [],
            loading: false,
          })
        }
        onCitationClick={setActiveCitation}
      />
    </div>
  );
}
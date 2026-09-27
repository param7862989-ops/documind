"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Square,
  Trash2,
  Upload,
  User,
  X,
  Eye,
  AlertCircle,
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
  getAuthToken,
  User as UserType,
  DocumentItem,
  DocumentChunk,
  Message,
  Citation,
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserType | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [inputValue, setInputValue] = useState("");
  const [searchValue, setSearchValue] = useState("");

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showDocuments, setShowDocuments] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [activeCitationModal, setActiveCitationModal] =
    useState<Citation | null>(null);

  const [inspectDocModal, setInspectDocModal] = useState<{
    doc: DocumentItem | null;
    chunks: DocumentChunk[];
    loading: boolean;
  }>({
    doc: null,
    chunks: [],
    loading: false,
  });

  const [comparisonModal, setComparisonModal] = useState<{
    open: boolean;
    answer: string;
    citations: Citation[];
  }>({
    open: false,
    answer: "",
    citations: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function initialize() {
      const token = getAuthToken();

      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        const docs = await getDocumentsList();

        setUser(currentUser);
        setDocuments(docs);
        setIsAuthChecking(false);
      } catch (error) {
        console.error("Dashboard initialization failed:", error);
        clearAuthToken();
        router.push("/login");
      }
    }

    initialize();
  }, [router]);

  useEffect(() => {
    const pending = documents.some(
      (document) =>
        document.status === "UPLOADING" ||
        document.status === "PROCESSING"
    );

    if (!pending) return;

    const interval = setInterval(async () => {
      try {
        const refreshedDocuments = await getDocumentsList();
        setDocuments(refreshedDocuments);
      } catch (error) {
        console.error("Document polling failed:", error);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [documents]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isSending]);

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;

    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);

    for (let index = 0; index < files.length; index++) {
      try {
        const uploadedDocument = await uploadDocumentFile(files[index]);

        setDocuments((previous) => [
          uploadedDocument,
          ...previous,
        ]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed.";

        setErrorMessage(
          `Could not upload ${files[index].name}: ${message}`
        );
      }
    }

    setIsUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleDeleteDocument(
    documentId: string,
    event: MouseEvent
  ) {
    event.stopPropagation();

    const confirmed = window.confirm(
      "Are you sure you want to delete this document?"
    );

    if (!confirmed) return;

    try {
      await deleteDocumentItem(documentId);

      setDocuments((previous) =>
        previous.filter((document) => document.id !== documentId)
      );

      setSelectedDocIds((previous) =>
        previous.filter((id) => id !== documentId)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Delete failed.";

      setErrorMessage(message);
    }
  }

  async function handleInspectDocument(
    document: DocumentItem,
    event: MouseEvent
  ) {
    event.stopPropagation();

    setInspectDocModal({
      doc: document,
      chunks: [],
      loading: true,
    });

    try {
      const chunks = await getDocumentChunks(document.id);

      setInspectDocModal({
        doc: document,
        chunks,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to load chunks:", error);

      setInspectDocModal({
        doc: document,
        chunks: [],
        loading: false,
      });
    }
  }

  function toggleDocument(documentId: string) {
    setSelectedDocIds((previous) =>
      previous.includes(documentId)
        ? previous.filter((id) => id !== documentId)
        : [...previous, documentId]
    );
  }

  function selectAllDocuments() {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
      return;
    }

    setSelectedDocIds(documents.map((document) => document.id));
  }

  async function handleSendMessage(customPrompt?: string) {
    const text = customPrompt ?? inputValue;

    if (!text.trim() || isSending) return;

    const userMessage: Message = {
      id: `temporary-${Date.now()}`,
      conversation_id: "current",
      role: "user",
      content: text,
      citations: [],
      created_at: new Date().toISOString(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInputValue("");
    setIsSending(true);
    setErrorMessage(null);

    try {
      const assistantMessage = await sendChatMessage(
        text,
        undefined,
        selectedDocIds.length > 0 ? selectedDocIds : undefined
      );

      setMessages((previous) => [
        ...previous,
        assistantMessage,
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to retrieve an answer.";

      setErrorMessage(message);
    } finally {
      setIsSending(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }

  async function handleCompareDocuments() {
    if (selectedDocIds.length < 2) {
      setErrorMessage(
        "Select at least two documents to compare."
      );
      return;
    }

    setIsComparing(true);
    setErrorMessage(null);

    try {
      const result = await compareDocumentsList(
        selectedDocIds,
        "Compare key terms, obligations, termination clauses, and financial commitments across these documents."
      );

      setComparisonModal({
        open: true,
        answer: result.answer,
        citations: result.citations,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Comparison failed.";

      setErrorMessage(message);
    } finally {
      setIsComparing(false);
    }
  }

  async function copyMessage(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1800);
    } catch {
      setErrorMessage("Could not copy the response.");
    }
  }

  function handleLogout() {
    clearAuthToken();
    router.push("/login");
  }

  function startNewChat() {
    setMessages([]);
    setInputValue("");
    setErrorMessage(null);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }

  const filteredDocuments = documents.filter((document) =>
    document.original_filename
      .toLowerCase()
      .includes(searchValue.toLowerCase())
  );

  const readyDocuments = documents.filter(
    (document) => document.status === "READY"
  ).length;

  const suggestions = [
    {
      title: "Summarize my documents",
      description: "Give me the key points and important details.",
    },
    {
      title: "Compare documents",
      description: "Find differences in terms, clauses, and obligations.",
    },
    {
      title: "Find important terms",
      description: "Locate deadlines, payments, renewals, and obligations.",
    },
    {
      title: "Analyze risks",
      description: "Identify unusual or potentially important provisions.",
    },
  ];

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-white/60">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading DocuMind...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white text-[#2f2f2f]">
      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col bg-[#171717] text-white transition-transform duration-200 md:relative md:z-20 md:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:w-0 md:overflow-hidden"
        }`}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between px-3">
          <button
            onClick={startNewChat}
            className="flex items-center gap-2.5 px-2 py-2"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[#171717]">
              <FileText className="h-4 w-4" />
            </div>

            <span className="text-[15px] font-semibold">
              DocuMind
            </span>
          </button>

          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-2 text-white/50 hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-2 pb-2">
          <button
            onClick={startNewChat}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
            <span>New chat</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

            <input
              value={searchValue}
              onChange={(event) =>
                setSearchValue(event.target.value)
              }
              placeholder="Search documents"
              className="w-full rounded-lg border border-white/10 bg-white/[0.06] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/20"
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="px-2">
          <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-white/35">
            Workspace
          </div>

          <button
            onClick={() => setShowDocuments(false)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
              !showDocuments
                ? "bg-white/10 text-white"
                : "text-white/65 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => setShowDocuments(true)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
              showDocuments
                ? "bg-white/10 text-white"
                : "text-white/65 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Documents</span>
            <span className="ml-auto text-[11px] text-white/35">
              {documents.length}
            </span>
          </button>
        </div>

        {/* Chat / Document history */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-5">
          {!showDocuments ? (
            <>
              <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-white/35">
                Current chat
              </div>

              {messages.length > 0 ? (
                <button
                  onClick={() => setShowDocuments(false)}
                  className="flex w-full items-center gap-3 rounded-lg bg-white/[0.06] px-3 py-2.5 text-left text-sm text-white"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-white/60" />

                  <span className="truncate">
                    {messages[0].content}
                  </span>
                </button>
              ) : (
                <div className="px-3 py-2 text-xs leading-5 text-white/35">
                  Your conversations will appear here.
                </div>
              )}

              <div className="mt-6 px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-white/35">
                Documents
              </div>

              <div className="space-y-0.5">
                {filteredDocuments.slice(0, 8).map((document) => (
                  <button
                    key={document.id}
                    onClick={() => toggleDocument(document.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs ${
                      selectedDocIds.includes(document.id)
                        ? "bg-white/10 text-white"
                        : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />

                    <span className="truncate">
                      {document.original_filename}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 pb-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-white/35">
                  All documents
                </span>

                <span className="text-[11px] text-white/30">
                  {documents.length}
                </span>
              </div>

              <div className="space-y-0.5">
                {filteredDocuments.map((document) => (
                  <DocumentSidebarItem
                    key={document.id}
                    document={document}
                    selected={selectedDocIds.includes(document.id)}
                    onSelect={() => toggleDocument(document.id)}
                    onInspect={(event) =>
                      handleInspectDocument(document, event)
                    }
                    onDelete={(event) =>
                      handleDeleteDocument(document.id, event)
                    }
                  />
                ))}

                {filteredDocuments.length === 0 && (
                  <div className="px-3 py-8 text-center text-xs text-white/35">
                    No documents found.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar bottom */}
        <div className="border-t border-white/10 p-2">
          <div className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-medium">
              {user?.full_name
                ? user.full_name.charAt(0).toUpperCase()
                : "U"}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white">
                {user?.full_name || "User"}
              </div>

              <div className="truncate text-[10px] text-white/35">
                {user?.email || ""}
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign out"
              className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex min-w-0 flex-1 flex-col bg-white">
        {/* HEADER */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.08] px-3 sm:px-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((value) => !value)}
              className="rounded-lg p-2 text-[#6b6b6b] hover:bg-[#f2f2f2] hover:text-[#2f2f2f]"
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={() => setShowDocuments(false)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-[#f5f5f5]"
            >
              <span>
                {showDocuments ? "Documents" : "DocuMind"}
              </span>

              {!showDocuments && (
                <ChevronDown className="h-3.5 w-3.5 text-[#8a8a8a]" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              title="Settings"
              className="rounded-lg p-2 text-[#777] hover:bg-[#f2f2f2] hover:text-[#333]"
            >
              <Settings className="h-4 w-4" />
            </button>

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ececec] text-[#555]">
              {user?.full_name ? (
                <span className="text-xs font-semibold">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
          </div>
        </header>

        {/* ERROR */}
        {errorMessage && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2.5">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 text-xs text-red-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>

              <button
                onClick={() => setErrorMessage(null)}
                className="rounded p-1 hover:bg-red-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {showDocuments ? (
          <DocumentsWorkspace
            documents={filteredDocuments}
            selectedDocIds={selectedDocIds}
            isUploading={isUploading}
            isComparing={isComparing}
            fileInputRef={fileInputRef}
            onUpload={() => fileInputRef.current?.click()}
            onFileUpload={handleFileUpload}
            onSelect={toggleDocument}
            onSelectAll={selectAllDocuments}
            onCompare={handleCompareDocuments}
            onInspect={handleInspectDocument}
            onDelete={handleDeleteDocument}
          />
        ) : (
          <ChatWorkspace
            documents={documents}
            selectedDocIds={selectedDocIds}
            messages={messages}
            inputValue={inputValue}
            isSending={isSending}
            copiedIndex={copiedIndex}
            user={user}
            inputRef={inputRef}
            chatBottomRef={chatBottomRef}
            suggestions={suggestions}
            onInputChange={setInputValue}
            onSend={handleSendMessage}
            onCopy={copyMessage}
            onCitation={setActiveCitationModal}
            onRemoveSelected={(id) =>
              setSelectedDocIds((previous) =>
                previous.filter((item) => item !== id)
              )
            }
          />
        )}
      </main>

      {/* INSPECT MODAL */}
      {inspectDocModal.doc && (
        <Modal
          title={inspectDocModal.doc.original_filename}
          icon={<FileText className="h-4 w-4" />}
          onClose={() =>
            setInspectDocModal({
              doc: null,
              chunks: [],
              loading: false,
            })
          }
        >
          <div className="mb-5 text-xs text-[#777]">
            {inspectDocModal.doc.file_type.toUpperCase()} ·{" "}
            {(inspectDocModal.doc.file_size / 1024).toFixed(1)} KB ·{" "}
            {inspectDocModal.doc.page_count || 0} pages ·{" "}
            {inspectDocModal.doc.chunk_count || 0} chunks
          </div>

          {inspectDocModal.loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-[#777]">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Loading extracted content...
            </div>
          ) : inspectDocModal.chunks.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#888]">
              No indexed chunks found.
            </div>
          ) : (
            <div className="space-y-3">
              {inspectDocModal.chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="rounded-xl border border-black/[0.08] bg-[#f7f7f7] p-4"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-black/[0.07] pb-2 text-[11px] text-[#777]">
                    <span className="font-medium text-[#555]">
                      Chunk {chunk.chunk_index + 1}
                    </span>

                    <span>
                      Page {chunk.page_number || 1}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-xs leading-6 text-[#444]">
                    {chunk.text_content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* CITATION MODAL */}
      {activeCitationModal && (
        <Modal
          title="Source"
          icon={<BookOpen className="h-4 w-4" />}
          onClose={() => setActiveCitationModal(null)}
        >
          <div className="mb-1 text-sm font-semibold text-[#222]">
            {activeCitationModal.document_title}
          </div>

          <div className="mb-5 text-xs text-[#777]">
            {activeCitationModal.page_number
              ? `Page ${activeCitationModal.page_number}`
              : ""}
            {activeCitationModal.section_title
              ? ` · ${activeCitationModal.section_title}`
              : ""}
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-[#f7f7f7] p-4">
            <p className="text-sm leading-6 text-[#444]">
              “{activeCitationModal.excerpt}”
            </p>
          </div>
        </Modal>
      )}

      {/* COMPARISON MODAL */}
      {comparisonModal.open && (
        <Modal
          title="Document comparison"
          icon={<Layers className="h-4 w-4" />}
          onClose={() =>
            setComparisonModal({
              open: false,
              answer: "",
              citations: [],
            })
          }
          wide
        >
          <div className="whitespace-pre-wrap text-sm leading-7 text-[#3f3f3f]">
            {comparisonModal.answer}
          </div>

          {comparisonModal.citations.length > 0 && (
            <div className="mt-8 border-t border-black/[0.08] pt-5">
              <div className="mb-3 text-xs font-semibold text-[#555]">
                Sources
              </div>

              <div className="flex flex-wrap gap-2">
                {comparisonModal.citations.map(
                  (citation, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        setActiveCitationModal(citation)
                      }
                      className="rounded-lg border border-black/[0.09] bg-[#f7f7f7] px-3 py-2 text-xs text-[#555] hover:bg-[#eeeeee]"
                    >
                      {citation.document_title}
                      {citation.page_number
                        ? ` · p. ${citation.page_number}`
                        : ""}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CHAT WORKSPACE */
/* -------------------------------------------------------------------------- */

function ChatWorkspace({
  documents,
  selectedDocIds,
  messages,
  inputValue,
  isSending,
  copiedIndex,
  user,
  inputRef,
  chatBottomRef,
  suggestions,
  onInputChange,
  onSend,
  onCopy,
  onCitation,
  onRemoveSelected,
}: {
  documents: DocumentItem[];
  selectedDocIds: string[];
  messages: Message[];
  inputValue: string;
  isSending: boolean;
  copiedIndex: number | null;
  user: UserType | null;
  inputRef: React.RefObject<HTMLInputElement>;
  chatBottomRef: React.RefObject<HTMLDivElement>;
  suggestions: {
    title: string;
    description: string;
  }[];
  onInputChange: (value: string) => void;
  onSend: (prompt?: string) => void;
  onCopy: (text: string, index: number) => void;
  onCitation: (citation: Citation) => void;
  onRemoveSelected: (id: string) => void;
}) {
  const hasDocuments = documents.length > 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* CHAT CONTENT */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center px-4 pb-40 pt-16 sm:pt-24">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#f1f1f1]">
              <Sparkles className="h-5 w-5 text-[#444]" />
            </div>

            <h1 className="text-center text-2xl font-semibold tracking-[-0.02em] text-[#2f2f2f] sm:text-3xl">
              What can I help you find?
            </h1>

            <p className="mt-3 max-w-lg text-center text-sm leading-6 text-[#777]">
              Ask questions about your documents, summarize content,
              compare files, or find specific clauses and information.
            </p>

            {!hasDocuments ? (
              <div className="mt-8 rounded-xl border border-black/[0.08] bg-[#f7f7f7] px-5 py-4 text-center">
                <FileText className="mx-auto mb-2 h-5 w-5 text-[#777]" />

                <p className="text-sm font-medium text-[#444]">
                  Upload a document to get started
                </p>

                <p className="mt-1 text-xs text-[#888]">
                  PDF, DOCX, TXT and image files are supported.
                </p>
              </div>
            ) : (
              <div className="mt-9 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    onClick={() => onSend(suggestion.title)}
                    className="group rounded-xl border border-black/[0.08] bg-white p-4 text-left transition hover:bg-[#f7f7f7]"
                  >
                    <div className="text-sm font-medium text-[#333]">
                      {suggestion.title}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-[#888]">
                      {suggestion.description}
                    </div>

                    <ChevronRight className="mt-3 h-4 w-4 text-[#aaa] transition group-hover:translate-x-0.5 group-hover:text-[#555]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
            {messages.map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                index={index}
                copied={copiedIndex === index}
                user={user}
                onCopy={onCopy}
                onCitation={onCitation}
              />
            ))}

            {isSending && (
              <div className="flex gap-4 py-6">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0]">
                  <Sparkles className="h-4 w-4 text-[#555]" />
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#888]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#888] [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#888] [animation-delay:240ms]" />
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        )}
      </div>

      {/* COMPOSER */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent px-3 pb-3 pt-12 sm:px-6">
        <div className="pointer-events-auto mx-auto w-full max-w-3xl">
          {selectedDocIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selectedDocIds.map((id) => {
                const document = documents.find(
                  (item) => item.id === id
                );

                if (!document) return null;

                return (
                  <button
                    key={id}
                    onClick={() => onRemoveSelected(id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11px] text-[#555] shadow-sm hover:bg-[#f5f5f5]"
                  >
                    <FileText className="h-3 w-3" />

                    <span className="max-w-[150px] truncate">
                      {document.original_filename}
                    </span>

                    <X className="h-3 w-3 text-[#999]" />
                  </button>
                );
              })}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSend();
            }}
            className="relative flex items-end rounded-2xl border border-black/[0.15] bg-white shadow-[0_2px_14px_rgba(0,0,0,0.08)] focus-within:border-black/[0.25]"
          >
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(event) =>
                onInputChange(event.target.value)
              }
              disabled={!hasDocuments || isSending}
              placeholder={
                hasDocuments
                  ? "Ask anything about your documents..."
                  : "Upload a document first..."
              }
              className="min-h-[52px] w-full bg-transparent px-4 py-3.5 pr-14 text-sm text-[#2f2f2f] outline-none placeholder:text-[#999] disabled:cursor-not-allowed"
            />

            <button
              type="submit"
              disabled={
                !inputValue.trim() ||
                !hasDocuments ||
                isSending
              }
              className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#2f2f2f] text-white transition hover:bg-[#111] disabled:bg-[#e5e5e5] disabled:text-[#aaa]"
            >
              {isSending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-[10px] text-[#999]">
            DocuMind can make mistakes. Check cited sources for important information.
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MESSAGE */
/* -------------------------------------------------------------------------- */

function MessageRow({
  message,
  index,
  copied,
  user,
  onCopy,
  onCitation,
}: {
  message: Message;
  index: number;
  copied: boolean;
  user: UserType | null;
  onCopy: (text: string, index: number) => void;
  onCitation: (citation: Citation) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-4 py-6 ${
        isUser ? "justify-end" : ""
      }`}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0]">
          <Sparkles className="h-4 w-4 text-[#555]" />
        </div>
      )}

      <div
        className={`group max-w-[85%] sm:max-w-[78%] ${
          isUser ? "order-first" : ""
        }`}
      >
        <div
          className={`text-sm leading-7 ${
            isUser
              ? "rounded-2xl bg-[#f4f4f4] px-4 py-2.5 text-[#333]"
              : "text-[#333]"
          }`}
        >
          <div className="whitespace-pre-wrap">
            {message.content}
          </div>
        </div>

        {!isUser && (
          <div className="mt-3 flex items-center gap-1">
            <button
              onClick={() => onCopy(message.content, index)}
              title="Copy"
              className="rounded-md p-1.5 text-[#999] opacity-0 transition hover:bg-[#f2f2f2] hover:text-[#555] group-hover:opacity-100"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}

        {!isUser &&
          message.citations &&
          message.citations.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[#777]">
                <BookOpen className="h-3.5 w-3.5" />
                Sources
              </div>

              <div className="flex flex-wrap gap-1.5">
                {message.citations.map((citation, citationIndex) => (
                  <button
                    key={citationIndex}
                    onClick={() => onCitation(citation)}
                    className="inline-flex max-w-[230px] items-center gap-2 rounded-lg border border-black/[0.08] bg-[#f8f8f8] px-2.5 py-1.5 text-left text-[11px] text-[#555] hover:bg-[#eeeeee]"
                  >
                    <FileText className="h-3 w-3 shrink-0 text-[#888]" />

                    <span className="truncate">
                      {citation.document_title}
                    </span>

                    {citation.page_number && (
                      <span className="shrink-0 text-[#999]">
                        p. {citation.page_number}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7e7e7] text-[#555]">
          <span className="text-xs font-semibold">
            {user?.full_name
              ? user.full_name.charAt(0).toUpperCase()
              : "U"}
          </span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* DOCUMENTS WORKSPACE */
/* -------------------------------------------------------------------------- */

function DocumentsWorkspace({
  documents,
  selectedDocIds,
  isUploading,
  isComparing,
  fileInputRef,
  onUpload,
  onFileUpload,
  onSelect,
  onSelectAll,
  onCompare,
  onInspect,
  onDelete,
}: {
  documents: DocumentItem[];
  selectedDocIds: string[];
  isUploading: boolean;
  isComparing: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUpload: () => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onCompare: () => void;
  onInspect: (
    document: DocumentItem,
    event: MouseEvent
  ) => void;
  onDelete: (
    documentId: string,
    event: MouseEvent
  ) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2f2f2f]">
              Documents
            </h1>

            <p className="mt-1 text-sm text-[#777]">
              Upload and manage the documents DocuMind can analyze.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
              onChange={onFileUpload}
              className="hidden"
            />

            <button
              onClick={onUpload}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2f2f2f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#111] disabled:opacity-50"
            >
              {isUploading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}

              {isUploading
                ? "Uploading..."
                : "Upload documents"}
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-black/[0.08] bg-[#fafafa] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-[#444]">
                Document selection
              </div>

              <div className="mt-1 text-xs text-[#888]">
                {selectedDocIds.length === 0
                  ? "All documents will be searched."
                  : `${selectedDocIds.length} document${
                      selectedDocIds.length === 1 ? "" : "s"
                    } selected.`}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onSelectAll}
                className="inline-flex items-center gap-2 rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-xs font-medium text-[#555] hover:bg-[#f2f2f2]"
              >
                {selectedDocIds.length === documents.length &&
                documents.length > 0 ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}

                Select all
              </button>

              {selectedDocIds.length >= 2 && (
                <button
                  onClick={onCompare}
                  disabled={isComparing}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2f2f2f] px-3 py-2 text-xs font-medium text-white hover:bg-[#111] disabled:opacity-50"
                >
                  {isComparing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Layers className="h-3.5 w-3.5" />
                  )}

                  Compare
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
          {documents.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <FileText className="mx-auto h-8 w-8 text-[#aaa]" />

              <h3 className="mt-4 text-sm font-medium text-[#444]">
                No documents yet
              </h3>

              <p className="mt-1 text-xs text-[#888]">
                Upload your first document to begin.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.07]">
              {documents.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  selected={selectedDocIds.includes(document.id)}
                  onSelect={() => onSelect(document.id)}
                  onInspect={(event) =>
                    onInspect(document, event)
                  }
                  onDelete={(event) =>
                    onDelete(document.id, event)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* DOCUMENT ROW */
/* -------------------------------------------------------------------------- */

function DocumentRow({
  document,
  selected,
  onSelect,
  onInspect,
  onDelete,
}: {
  document: DocumentItem;
  selected: boolean;
  onSelect: () => void;
  onInspect: (event: MouseEvent) => void;
  onDelete: (event: MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-3 px-4 py-3.5 transition hover:bg-[#fafafa] sm:px-5 ${
        selected ? "bg-[#f7f7f7]" : ""
      }`}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        className="shrink-0 text-[#999]"
      >
        {selected ? (
          <CheckSquare className="h-4 w-4 text-[#444]" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1f1f1]">
        <FileText className="h-4 w-4 text-[#666]" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[#333]">
          {document.original_filename}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#999]">
          <span className="uppercase">
            {document.file_type}
          </span>

          <span>·</span>

          <span>
            {(document.file_size / 1024).toFixed(1)} KB
          </span>

          {document.page_count > 0 && (
            <>
              <span>·</span>
              <span>{document.page_count} pages</span>
            </>
          )}
        </div>
      </div>

      <StatusBadge status={document.status} />

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={onInspect}
          title="Inspect"
          className="rounded-md p-2 text-[#999] hover:bg-[#eeeeee] hover:text-[#444]"
        >
          <Eye className="h-4 w-4" />
        </button>

        <button
          onClick={onDelete}
          title="Delete"
          className="rounded-md p-2 text-[#999] hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SIDEBAR DOCUMENT */
/* -------------------------------------------------------------------------- */

function DocumentSidebarItem({
  document,
  selected,
  onSelect,
  onInspect,
  onDelete,
}: {
  document: DocumentItem;
  selected: boolean;
  onSelect: () => void;
  onInspect: (event: MouseEvent) => void;
  onDelete: (event: MouseEvent) => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-3 py-2 ${
        selected ? "bg-white/10" : "hover:bg-white/[0.06]"
      }`}
    >
      <button
        onClick={onSelect}
        className="min-w-0 flex flex-1 items-center gap-3 text-left"
      >
        <FileText
          className={`h-4 w-4 shrink-0 ${
            selected ? "text-white" : "text-white/40"
          }`}
        />

        <span
          title={document.original_filename}
          className={`truncate text-xs ${
            selected ? "text-white" : "text-white/60"
          }`}
        >
          {document.original_filename}
        </span>
      </button>

      <button
        onClick={onInspect}
        className="hidden rounded p-1 text-white/30 hover:bg-white/10 hover:text-white group-hover:block"
      >
        <Eye className="h-3 w-3" />
      </button>

      <button
        onClick={onDelete}
        className="hidden rounded p-1 text-white/30 hover:bg-white/10 hover:text-red-400 group-hover:block"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* STATUS */
/* -------------------------------------------------------------------------- */

function StatusBadge({
  status,
}: {
  status: DocumentItem["status"];
}) {
  if (status === "READY") {
    return (
      <span className="hidden shrink-0 text-[11px] text-emerald-600 sm:block">
        Ready
      </span>
    );
  }

  if (status === "PROCESSING") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-amber-600">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span className="hidden sm:block">Processing</span>
      </span>
    );
  }

  if (status === "UPLOADING") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-blue-600">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span className="hidden sm:block">Uploading</span>
      </span>
    );
  }

  return (
    <span className="shrink-0 text-[11px] text-red-600">
      Failed
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* MODAL */
/* -------------------------------------------------------------------------- */

function Modal({
  title,
  icon,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div
        className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-black/[0.1] bg-white shadow-2xl ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.08] px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f1f1f1] text-[#555]">
                {icon}
              </div>
            )}

            <h2 className="truncate text-sm font-semibold text-[#333]">
              {title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#999] hover:bg-[#f1f1f1] hover:text-[#333]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
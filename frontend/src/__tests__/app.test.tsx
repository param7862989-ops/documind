import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { StatusIndicator } from "@/components/common/StatusIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { DocumentCard } from "@/components/dashboard/DocumentCard";
import { DocumentList } from "@/components/dashboard/DocumentList";
import { ChatMessage } from "@/components/dashboard/ChatMessage";
import { CitationCard } from "@/components/dashboard/CitationCard";
import { CitationModal } from "@/components/dashboard/CitationModal";
import { ComparisonView } from "@/components/dashboard/ComparisonView";
import { ChatInput } from "@/components/dashboard/ChatInput";
import { ConversationList } from "@/components/dashboard/ConversationList";
import { FileText } from "lucide-react";
import { DocumentItem, Message, Citation, Conversation, User } from "@/lib/api";

const mockUser: User = {
  id: "user-123",
  email: "test@documind.ai",
  full_name: "Test User",
  is_active: true,
  is_superuser: false,
  created_at: new Date().toISOString(),
};

const mockDocA: DocumentItem = {
  id: "doc-1",
  user_id: "user-123",
  title: "AlphaCorp Agreement",
  original_filename: "AlphaCorp_Agreement.pdf",
  file_type: "pdf",
  file_size: 1024 * 500,
  storage_path: "uploads/user-123/doc-1/original.pdf",
  status: "READY",
  page_count: 5,
  chunk_count: 8,
  created_at: new Date().toISOString(),
};

const mockDocB: DocumentItem = {
  id: "doc-2",
  user_id: "user-123",
  title: "BetaTech Vendor Agreement",
  original_filename: "BetaTech_Agreement.docx",
  file_type: "docx",
  file_size: 1024 * 300,
  storage_path: "uploads/user-123/doc-2/original.docx",
  status: "PROCESSING",
  page_count: 3,
  chunk_count: 4,
  created_at: new Date().toISOString(),
};

const mockCitation: Citation = {
  document_id: "doc-1",
  document_title: "AlphaCorp Agreement.pdf",
  page_number: 3,
  section_title: "Section 4.2 Payment Terms",
  excerpt: "Annual license fee is $120,000 billed annually in advance. Late payments accrue 1.5% interest.",
  score: 0.89,
};

const mockMessage: Message = {
  id: "msg-1",
  conversation_id: "conv-1",
  role: "assistant",
  content: "Based on AlphaCorp Agreement, the annual license fee is $120,000.",
  citations: [mockCitation],
  created_at: new Date().toISOString(),
};

const mockConversation: Conversation = {
  id: "conv-1",
  user_id: "user-123",
  title: "Pricing Discussion",
  selected_document_ids: ["doc-1"],
  messages: [mockMessage],
  created_at: new Date().toISOString(),
};

describe("DocuMind Frontend Component Suite", () => {
  it("renders StatusIndicator across all processing lifecycle states", () => {
    const { rerender } = render(<StatusIndicator status="READY" />);
    expect(screen.getByText("Ready")).toBeInTheDocument();

    rerender(<StatusIndicator status="PROCESSING" />);
    expect(screen.getByText("Processing")).toBeInTheDocument();

    rerender(<StatusIndicator status="UPLOADING" />);
    expect(screen.getByText("Uploading")).toBeInTheDocument();

    rerender(<StatusIndicator status="FAILED" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders EmptyState and handles action trigger", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        icon={FileText}
        title="No Documents"
        description="Please upload a document to get started."
        action={{ label: "Upload Document", onClick: onAction }}
      />
    );

    expect(screen.getByText("No Documents")).toBeInTheDocument();
    expect(screen.getByText("Please upload a document to get started.")).toBeInTheDocument();
    
    const btn = screen.getByText("Upload Document");
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders ErrorState and triggers retry and dismiss", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();
    render(
      <ErrorState
        message="Backend network failure"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText("Backend network failure")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Dismiss error"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders DocumentCard with metadata and selection", () => {
    const onSelect = vi.fn();
    const onInspect = vi.fn();
    const onDelete = vi.fn();

    render(
      <DocumentCard
        document={mockDocA}
        selected={false}
        onSelect={onSelect}
        onInspect={onInspect}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText("AlphaCorp_Agreement.pdf")).toBeInTheDocument();
    expect(screen.getByText(/500.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/5 pages/)).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();

    fireEvent.click(screen.getByText("AlphaCorp_Agreement.pdf"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders DocumentList with select all and comparison triggers", () => {
    const onSelectAll = vi.fn();
    const onCompare = vi.fn();

    render(
      <DocumentList
        documents={[mockDocA, mockDocB]}
        selectedDocIds={["doc-1", "doc-2"]}
        isComparing={false}
        onSelect={vi.fn()}
        onSelectAll={onSelectAll}
        onCompare={onCompare}
        onInspect={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("AlphaCorp_Agreement.pdf")).toBeInTheDocument();
    expect(screen.getByText("BetaTech_Agreement.docx")).toBeInTheDocument();
    expect(screen.getByText("Compare 2 Selected")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Compare 2 Selected"));
    expect(onCompare).toHaveBeenCalledTimes(1);
  });

  it("renders ChatMessage with citation card chips and handles citation click", () => {
    const onCitationClick = vi.fn();

    render(
      <ChatMessage
        message={mockMessage}
        user={mockUser}
        onCitationClick={onCitationClick}
      />
    );

    expect(screen.getByText(/Based on AlphaCorp Agreement/)).toBeInTheDocument();
    expect(screen.getByText("AlphaCorp Agreement.pdf")).toBeInTheDocument();
    expect(screen.getByText("p. 3")).toBeInTheDocument();

    fireEvent.click(screen.getByText("AlphaCorp Agreement.pdf"));
    expect(onCitationClick).toHaveBeenCalledWith(mockCitation);
  });

  it("renders CitationModal and displays verbatim source quotation", () => {
    const onClose = vi.fn();

    render(<CitationModal citation={mockCitation} onClose={onClose} />);

    expect(screen.getByText("Verified Source Citation")).toBeInTheDocument();
    expect(screen.getByText(/Annual license fee is \$120,000/)).toBeInTheDocument();
    expect(screen.getByText(/Section 4.2 Payment Terms/)).toBeInTheDocument();
  });

  it("renders ComparisonView with structured comparison table", () => {
    const comparisonText = `### Document Comparison Analysis\n\n| Document | Key Finding | Citation |\n| :--- | :--- | :--- |\n| **AlphaCorp** | 500 enterprise seats | [AlphaCorp, p.1] |\n| **BetaTech** | 250 enterprise seats | [BetaTech, p.2] |`;

    render(
      <ComparisonView
        open={true}
        answer={comparisonText}
        citations={[mockCitation]}
        onClose={vi.fn()}
        onCitationClick={vi.fn()}
      />
    );

    expect(screen.getByText("Multi-Document Comparative Analysis")).toBeInTheDocument();
    expect(screen.getByText("500 enterprise seats")).toBeInTheDocument();
    expect(screen.getByText("250 enterprise seats")).toBeInTheDocument();
  });

  it("submits ChatInput on form submit", () => {
    const onSend = vi.fn();
    const onInputChange = vi.fn();

    render(
      <ChatInput
        inputValue="What is the pricing?"
        isSending={false}
        hasDocuments={true}
        selectedDocIds={["doc-1"]}
        documents={[mockDocA]}
        onInputChange={onInputChange}
        onSend={onSend}
        onRemoveDoc={vi.fn()}
      />
    );

    const input = screen.getByLabelText("Chat query input");
    expect(input).toHaveValue("What is the pricing?");

    fireEvent.submit(input.closest("form")!);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("renders ConversationList and switches conversation on click", () => {
    const onSelectConversation = vi.fn();
    const onDeleteConversation = vi.fn();

    render(
      <ConversationList
        conversations={[mockConversation]}
        activeConversationId="conv-1"
        onSelectConversation={onSelectConversation}
        onNewChat={vi.fn()}
        onDeleteConversation={onDeleteConversation}
      />
    );

    expect(screen.getByText("Pricing Discussion")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Pricing Discussion"));
    expect(onSelectConversation).toHaveBeenCalledWith("conv-1");
  });
});

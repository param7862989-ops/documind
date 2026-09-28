import React, { MouseEvent } from "react";
import Link from "next/link";
import {
  FileText,
  MessageSquare,
  Plus,
  Search,
  LogOut,
  X,
  Eye,
  Trash2,
} from "lucide-react";
import { User as UserType, DocumentItem, Conversation } from "@/lib/api";
import { ConversationList } from "./ConversationList";

interface SidebarProps {
  isOpen: boolean;
  user: UserType | null;
  documents: DocumentItem[];
  conversations: Conversation[];
  activeConversationId: string | null;
  activeView: "chat" | "documents";
  selectedDocIds: string[];
  searchValue: string;
  onClose: () => void;
  onNewChat: () => void;
  onViewChange: (view: "chat" | "documents") => void;
  onSearchChange: (val: string) => void;
  onToggleDoc: (id: string) => void;
  onInspectDoc: (doc: DocumentItem, e: MouseEvent) => void;
  onDeleteDoc: (id: string, e: MouseEvent) => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string, e: MouseEvent) => void;
  onLogout: () => void;
  className?: string;
}

export function Sidebar({
  isOpen,
  user,
  documents,
  conversations,
  activeConversationId,
  activeView,
  selectedDocIds,
  searchValue,
  onClose,
  onNewChat,
  onViewChange,
  onSearchChange,
  onToggleDoc,
  onInspectDoc,
  onDeleteDoc,
  onSelectConversation,
  onDeleteConversation,
  onLogout,
  className = "",
}: SidebarProps) {
  const filteredDocuments = documents.filter((doc) =>
    doc.original_filename.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#171717] text-white transition-transform duration-200 ease-in-out md:relative md:z-20 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:w-0 md:overflow-hidden"
        } ${className}`}
      >
        {/* Brand & Close */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/[0.08]">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#171717] shadow-xs group-hover:scale-105 transition">
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">
              DocuMind
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action: New Chat */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onViewChange("chat");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.1] hover:bg-white/[0.18] px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat Conversation</span>
          </button>
        </div>

        {/* View Switcher: Chat vs Documents */}
        <div className="px-3 pb-2 grid grid-cols-2 gap-1 bg-white/[0.04] p-1 rounded-xl mx-3">
          <button
            type="button"
            onClick={() => onViewChange("chat")}
            className={`flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-medium transition ${
              activeView === "chat"
                ? "bg-white text-[#171717] shadow-xs"
                : "text-white/60 hover:text-white"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange("documents")}
            className={`flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-medium transition ${
              activeView === "documents"
                ? "bg-white text-[#171717] shadow-xs"
                : "text-white/60 hover:text-white"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Docs ({documents.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter documents..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2 pl-9 pr-3 text-xs text-white placeholder-white/40 outline-hidden focus:border-white/30 transition"
            />
          </div>
        </div>

        {/* Scrollable Center: Conversations or Documents */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {activeView === "chat" ? (
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={(id) => {
                onSelectConversation(id);
                onViewChange("chat");
              }}
              onNewChat={onNewChat}
              onDeleteConversation={onDeleteConversation}
            />
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  Documents ({filteredDocuments.length})
                </span>
              </div>

              {filteredDocuments.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-white/35">
                  No documents found.
                </div>
              ) : (
                filteredDocuments.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className={`group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition ${
                        isSelected ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleDoc(doc.id)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      >
                        <FileText className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-white" : "text-white/40"}`} />
                        <span className="truncate text-xs">{doc.original_filename}</span>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => onInspectDoc(doc, e)}
                          title="Inspect chunks"
                          aria-label={`Inspect ${doc.original_filename}`}
                          className="rounded p-1 text-white/40 hover:bg-white/15 hover:text-white"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => onDeleteDoc(doc.id, e)}
                          title="Delete document"
                          aria-label={`Delete ${doc.original_filename}`}
                          className="rounded p-1 text-white/40 hover:bg-white/15 hover:text-rose-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer: User Profile & Logout */}
        <div className="border-t border-white/[0.08] p-3 bg-black/20">
          <div className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.12] text-xs font-semibold text-white">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">
                  {user?.full_name || "User"}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {user?.email || ""}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              title="Sign Out"
              aria-label="Sign out of your account"
              className="rounded-lg p-2 text-white/40 hover:bg-white/15 hover:text-white transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Shield, Eye, MessageSquare, Image as ImageIcon, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const API_BASE = '/api';

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function GuardianMessages() {
  const { wardPersonId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedConversation, setSelectedConversation] = useState(null);

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const ward = people.find(p => p.id === wardPersonId);

  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ['guardian-conversations', wardPersonId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/entities/guardian/${wardPersonId}/conversations`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load conversations');
      return res.json();
    },
    enabled: !!wardPersonId,
  });

  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['guardian-messages', wardPersonId, selectedConversation?.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/entities/guardian/${wardPersonId}/messages?conversation_id=${selectedConversation.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load messages');
      return res.json();
    },
    enabled: !!selectedConversation,
  });

  const getPersonName = (id) => people.find(p => p.id === id)?.name || 'Unknown';
  const getPersonPhoto = (id) => people.find(p => p.id === id)?.photo_url;

  const getConversationName = (conv) => {
    if (conv.name) return conv.name;
    const otherIds = (conv.participant_ids || []).filter(id => id !== wardPersonId);
    return otherIds.map(getPersonName).join(', ') || 'Conversation';
  };

  const showSidebar = !isMobile || !selectedConversation;
  const showChat = !isMobile || selectedConversation;

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)]">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-100">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-slate-100">
            {ward?.name ? `${ward.name}'s Messages` : 'Messages'} 
          </h1>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Read-Only</span>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden h-[calc(100%-3rem)] flex">
        {showSidebar && (
          <div className={cn("border-r border-slate-700/50 flex flex-col", isMobile ? "w-full" : "w-80")}>
            <div className="p-4 border-b border-slate-700/50">
              <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Conversations
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="p-4 text-center text-slate-500 text-sm">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No conversations found</div>
              ) : conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={cn(
                    "w-full text-left p-4 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors",
                    selectedConversation?.id === conv.id && "bg-slate-800/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200 truncate">{getConversationName(conv)}</p>
                    <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {conv.participant_ids?.length || 0} participants
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {showChat && (
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-slate-700/50 flex items-center gap-3">
                  {isMobile && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedConversation(null)} className="text-slate-400 -ml-2">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-slate-200">{getConversationName(selectedConversation)}</h3>
                    <p className="text-xs text-slate-500">
                      {(selectedConversation.participant_ids || []).map(getPersonName).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="text-center text-slate-500 text-sm py-8">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-8">No messages in this conversation</div>
                  ) : messages.map(msg => {
                    const isWard = msg.from_person_id === wardPersonId;
                    const senderPhoto = getPersonPhoto(msg.from_person_id);
                    return (
                      <div key={msg.id} className={cn("flex gap-2", isWard ? "justify-end" : "justify-start")}>
                        {!isWard && (
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 mt-1">
                            {senderPhoto ? (
                              <img src={senderPhoto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs text-slate-400">{getPersonName(msg.from_person_id)?.charAt(0)}</span>
                            )}
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2",
                          isWard ? "bg-amber-500/20 text-amber-100" : "bg-slate-800 text-slate-200"
                        )}>
                          <p className="text-xs text-slate-400 mb-1">{getPersonName(msg.from_person_id)}</p>
                          {msg.media_url && (
                            <img
                              src={msg.media_url}
                              alt=""
                              className="max-w-full rounded-lg mb-1 max-h-48 object-cover"
                            />
                          )}
                          {msg.content && <p className="text-sm">{msg.content}</p>}
                          <p className="text-[10px] text-slate-500 mt-1">
                            {msg.created_date ? format(new Date(msg.created_date), 'MMM d, h:mm a') : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="p-3 border-t border-slate-700/50">
                  <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-1">
                    <Eye className="w-3 h-3" />
                    Read-only view - you cannot send messages in this view
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a conversation to view messages</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

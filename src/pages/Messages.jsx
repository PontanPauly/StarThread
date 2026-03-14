import React, { useState, useEffect, useRef, useCallback } from "react";
import ParentalGate from "@/components/ParentalGate";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useMyPerson } from "@/hooks/useMyPerson";
import { MessageCircle, Send, User, Image as ImageIcon, Plus, X, Users, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

function useWebSocket(queryClient, userProfile) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  useEffect(() => {
    if (!userProfile) return;

    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const { event: evt, data } = JSON.parse(event.data);
          if (evt === 'new_message') {
            queryClient.setQueryData(['messages'], (old) => {
              if (!old) return [data];
              if (old.some(m => m.id === data.id)) return old;
              return [data, ...old];
            });
          }
          if (evt === 'new_conversation') {
            queryClient.invalidateQueries(['conversations']);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [userProfile, queryClient]);
}

export default function Messages() {
  const { user } = useAuth();
  const { data: myPersonData } = useMyPerson();
  const [userProfile, setUserProfile] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: universeData } = useQuery({
    queryKey: ['universe-members'],
    queryFn: async () => {
      const res = await fetch('/api/family/universe-members', { credentials: 'include' });
      if (!res.ok) return { people: [], relationships: [], households: [] };
      return res.json();
    },
    staleTime: 30000,
  });
  const people = universeData?.people || [];

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => base44.entities.Conversation.list('-created_date'),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn: () => base44.entities.Message.list('-created_date'),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (myPersonData) {
      setUserProfile(myPersonData);
    }
  }, [myPersonData]);

  useWebSocket(queryClient, userProfile);

  const createConversation = useMutation({
    mutationFn: (data) => base44.entities.Conversation.create(data),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries(['conversations']);
      setSelectedConversation(newConv);
      setSelectedMembers([]);
      setGroupName("");
      setShowNewChatDialog(false);
    },
  });

  const sendMessage = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages']);
      setMessageText("");
      setImagePreview(null);
      setImageFile(null);
      scrollToBottom();
    },
  });

  const markAsRead = useMutation({
    mutationFn: ({ id }) => base44.entities.Message.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries(['messages']),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedConversation]);

  useEffect(() => {
    if (selectedConversation && userProfile) {
      const unreadMessages = messages.filter(m =>
        m.conversation_id === selectedConversation.id &&
        m.from_person_id !== userProfile.id &&
        !m.is_read
      );
      unreadMessages.forEach(msg => {
        markAsRead.mutate({ id: msg.id });
      });
    }
  }, [selectedConversation, messages, userProfile]);

  const conversationList = React.useMemo(() => {
    if (!userProfile) return [];

    return conversations
      .filter(conv => conv.participant_ids.includes(userProfile.id))
      .map(conv => {
        const convMessages = messages.filter(m => m.conversation_id === conv.id);
        const sortedMsgs = convMessages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        const lastMessage = sortedMsgs[sortedMsgs.length - 1];
        const unreadCount = convMessages.filter(m => !m.is_read && m.from_person_id !== userProfile.id).length;

        let displayName = conv.name;
        if (conv.type === 'direct') {
          const otherPersonId = conv.participant_ids.find(id => id !== userProfile.id);
          const otherPerson = people.find(p => p.id === otherPersonId);
          displayName = otherPerson?.name || "Unknown";
        }

        return {
          conversation: conv,
          displayName,
          lastMessage,
          unreadCount,
        };
      })
      .filter(c => c.lastMessage)
      .sort((a, b) => new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date));
  }, [conversations, messages, people, userProfile]);

  const filteredPeople = people.filter(p =>
    p.id !== userProfile?.id && !p.is_deceased && !p.is_memorial
  );

  const selectedMessages = selectedConversation
    ? messages.filter(m => m.conversation_id === selectedConversation.id)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    : [];

  const handleCreateConversation = () => {
    if (selectedMembers.length === 0) return;

    const isGroup = selectedMembers.length > 1;
    createConversation.mutate({
      type: isGroup ? 'group' : 'direct',
      name: isGroup ? groupName : undefined,
      participant_ids: [...selectedMembers, userProfile.id],
      created_by_person_id: userProfile.id,
    });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!messageText.trim() && !imageFile) || !selectedConversation || !userProfile) return;

    let mediaUrl = null;
    if (imageFile) {
      setIsUploadingImage(true);
      try {
        const result = await base44.integrations.Core.UploadFile({ file: imageFile });
        mediaUrl = result.file_url;
      } catch (err) {
        console.error('Image upload failed:', err);
        setIsUploadingImage(false);
        return;
      }
      setIsUploadingImage(false);
    }

    const msgData = {
      from_person_id: userProfile.id,
      conversation_id: selectedConversation.id,
    };
    if (messageText.trim()) msgData.content = messageText.trim();
    if (mediaUrl) msgData.media_url = mediaUrl;

    sendMessage.mutate(msgData);
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) return format(messageDate, 'h:mm a');
    if (isYesterday(messageDate)) return 'Yesterday';
    return format(messageDate, 'MMM d');
  };

  const getLastMessagePreview = (msg) => {
    if (msg.media_url && !msg.content) return "\uD83D\uDCF7 Photo";
    if (msg.media_url && msg.content) return `\uD83D\uDCF7 ${msg.content}`;
    return msg.content;
  };

  const getConversationDisplayName = (conv) => {
    if (conv.type === 'group') return conv.name;
    const otherPersonId = conv.participant_ids.find(id => id !== userProfile?.id);
    return people.find(p => p.id === otherPersonId)?.name || "Unknown";
  };

  if (!user || !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const showSidebar = !isMobile || !selectedConversation;
  const showChat = !isMobile || selectedConversation;

  return (<ParentalGate featureKey="messaging">
    <div className="max-w-7xl mx-auto h-[calc(100dvh-8rem)]">
      <div className="glass-card rounded-2xl overflow-hidden h-full flex">
        {showSidebar && (
          <div className={cn("border-r border-slate-700/50 flex flex-col", isMobile ? "w-full" : "w-80")}>
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-amber-400" />
                  Messages
                </h1>
                <Button
                  onClick={() => setShowNewChatDialog(true)}
                  size="icon"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-2">
                {conversationList.length > 0 ? conversationList.map(({ conversation, displayName, lastMessage, unreadCount }) => (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={cn(
                      "w-full p-3 rounded-lg transition-colors text-left mb-1",
                      selectedConversation?.id === conversation.id
                        ? "bg-amber-500/10 border border-amber-500/30"
                        : "hover:bg-slate-800/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {conversation.type === 'group' ? (
                          <Users className="w-5 h-5 text-amber-400" />
                        ) : (
                          <span className="text-sm font-medium text-slate-400">{displayName?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-slate-100 text-sm truncate">{displayName}</h3>
                          <span className="text-xs text-slate-500">{formatMessageTime(lastMessage.created_date)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-400 truncate">{getLastMessagePreview(lastMessage)}</p>
                          {unreadCount > 0 && (
                            <span className="ml-2 bg-amber-500 text-slate-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="text-center py-12 px-4">
                    <MessageCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No conversations yet</p>
                    <p className="text-slate-600 text-xs mt-1">Click + to start chatting</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showChat && (
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-slate-700/50 flex items-center gap-3">
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedConversation(null)}
                      className="text-slate-400 hover:text-slate-100 -ml-2"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                  )}
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                    {selectedConversation.type === 'group' ? (
                      <Users className="w-5 h-5 text-amber-400" />
                    ) : (
                      <span className="text-sm font-medium text-slate-400">
                        {getConversationDisplayName(selectedConversation)?.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-100">
                      {getConversationDisplayName(selectedConversation)}
                    </h2>
                    {selectedConversation.type === 'group' && (
                      <p className="text-xs text-slate-400">{selectedConversation.participant_ids.length} members</p>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedMessages.map((msg) => {
                    const isFromMe = msg.from_person_id === userProfile.id;
                    return (
                      <div key={msg.id} className={cn("flex", isFromMe ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2",
                          isFromMe
                            ? "bg-amber-500 text-slate-900"
                            : "bg-slate-800 text-slate-100"
                        )}>
                          {msg.media_url && (
                            <img
                              src={msg.media_url}
                              alt=""
                              className="rounded-lg max-w-full max-h-64 object-contain mb-1 cursor-pointer"
                              onClick={() => window.open(msg.media_url, '_blank')}
                            />
                          )}
                          {msg.content && <p className="text-sm">{msg.content}</p>}
                          <p className={cn("text-xs mt-1", isFromMe ? "text-slate-800/70" : "text-slate-500")}>
                            {formatMessageTime(msg.created_date)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-slate-700/50">
                  {imagePreview && (
                    <div className="mb-2 relative inline-block">
                      <img src={imagePreview} alt="Preview" className="h-20 rounded-lg object-cover" />
                      <button
                        onClick={clearImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-slate-400 hover:text-amber-400 flex-shrink-0"
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </Button>
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-800 border-slate-700 text-slate-100"
                      disabled={isUploadingImage}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={(!messageText.trim() && !imageFile) || isUploadingImage}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-300 mb-2">Select a Conversation</h3>
                  <p className="text-slate-500">Choose a family member to start chatting</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Start a Conversation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredPeople.map(person => (
                <button
                  key={person.id}
                  onClick={() => {
                    if (selectedMembers.includes(person.id)) {
                      setSelectedMembers(selectedMembers.filter(id => id !== person.id));
                    } else {
                      setSelectedMembers([...selectedMembers, person.id]);
                    }
                  }}
                  className="w-full p-3 rounded-lg hover:bg-slate-800 transition-colors text-left flex items-center gap-3 border border-transparent hover:border-slate-700"
                >
                  <Checkbox
                    checked={selectedMembers.includes(person.id)}
                    className="bg-slate-800"
                  />
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {person.photo_url ? (
                      <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-slate-400">{person.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-100 text-sm">{person.name}</h3>
                    {person.nickname && <p className="text-xs text-slate-400">"{person.nickname}"</p>}
                  </div>
                </button>
              ))}
            </div>

            {selectedMembers.length > 1 && (
              <div>
                <label className="text-sm text-slate-300 block mb-2">Group Name</label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Cousins Chat"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowNewChatDialog(false);
                  setSelectedMembers([]);
                  setGroupName("");
                }}
                variant="outline"
                className="flex-1 border-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateConversation}
                disabled={selectedMembers.length === 0 || (selectedMembers.length > 1 && !groupName.trim())}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                Start Chat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </ParentalGate>);
}

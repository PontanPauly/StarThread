import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, isToday, isYesterday } from "date-fns";

export default function TripComments({ tripId, currentUser, people }) {
  const [commentText, setCommentText] = useState("");
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['trip-comments', tripId],
    queryFn: () => base44.entities.Moment.filter({ 
      trip_id: tripId,
      media_type: 'text'
    }),
    enabled: !!tripId,
  });

  const createComment = useMutation({
    mutationFn: (data) => base44.entities.Moment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['trip-comments', tripId]);
      setCommentText("");
      scrollToBottom();
    },
  });

  const deleteComment = useMutation({
    mutationFn: (id) => base44.entities.Moment.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['trip-comments', tripId]),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const handleSendComment = () => {
    if (!commentText.trim() || !currentUser) return;

    const myPerson = people.find(p => p.user_id === currentUser.id);
    
    createComment.mutate({
      trip_id: tripId,
      content: commentText.trim(),
      media_type: 'text',
      author_person_id: myPerson?.id,
      captured_date: new Date().toISOString().split('T')[0],
    });
  };

  const formatCommentTime = (date) => {
    const commentDate = new Date(date);
    if (isToday(commentDate)) return format(commentDate, 'h:mm a');
    if (isYesterday(commentDate)) return 'Yesterday';
    return format(commentDate, 'MMM d');
  };

  const getCommentAuthor = (authorId) => {
    return people.find(p => p.id === authorId);
  };

  const sortedComments = [...comments].sort((a, b) => 
    new Date(a.created_date) - new Date(b.created_date)
  );

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-[500px]">
        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedComments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <MessageCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500">No comments yet</p>
                <p className="text-slate-600 text-sm mt-1">Start the conversation!</p>
              </div>
            </div>
          ) : (
            sortedComments.map(comment => {
              const author = getCommentAuthor(comment.author_person_id);
              const isFromMe = author?.user_id === currentUser?.id;

              return (
                <div key={comment.id} className={`flex gap-3 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex-1 max-w-xs ${isFromMe ? 'order-2' : 'order-1'}`}>
                    {!isFromMe && author && (
                      <p className="text-xs text-slate-400 mb-1 px-2">{author.name}</p>
                    )}
                    <div className={`rounded-xl px-3 py-2 ${
                      isFromMe 
                        ? 'bg-amber-500 text-slate-900' 
                        : 'bg-slate-800 text-slate-100'
                    }`}>
                      <p className="text-sm break-words">{comment.content}</p>
                      <p className={`text-xs mt-1 ${
                        isFromMe ? 'text-slate-800/70' : 'text-slate-500'
                      }`}>
                        {formatCommentTime(comment.created_date)}
                      </p>
                    </div>
                  </div>
                  
                  {isFromMe && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteComment.mutate(comment.id)}
                      className="text-slate-500 hover:text-red-400 h-6 w-6 p-0"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Comment Input */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendComment();
                }
              }}
              placeholder="Add a comment..."
              className="flex-1 bg-slate-800 border-slate-700 text-slate-100"
            />
            <Button 
              onClick={handleSendComment}
              disabled={!commentText.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
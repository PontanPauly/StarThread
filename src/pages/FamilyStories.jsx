import React, { useState } from "react";
import ParentalGate from "@/components/ParentalGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BookOpen, Plus, Edit, Trash2, Calendar, User, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

export default function FamilyStories() {
  const [showForm, setShowForm] = useState(false);
  const [editingStory, setEditingStory] = useState(null);
  const queryClient = useQueryClient();

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['familyStories'],
    queryFn: () => base44.entities.FamilyStory.list('-created_date'),
  });

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

  const deleteStory = useMutation({
    mutationFn: (id) => base44.entities.FamilyStory.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['familyStories']),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (<ParentalGate featureKey="stories">
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-400" />
            Family Stories
          </h1>
          <p className="text-slate-400 mt-1">Preserve your family's history and memories</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
          <Plus className="w-4 h-4 mr-2" />
          New Story
        </Button>
      </div>

      {stories.length > 0 ? (
        <div className="space-y-6">
          {stories.map(story => {
            const author = people.find(p => p.id === story.author_person_id);
            const subjects = (story.related_person_ids || []).map(id => people.find(p => p.id === id)).filter(Boolean);

            return (
              <div key={story.id} className="glass-card rounded-2xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-slate-100 mb-2">{story.title}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                      {author && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {author.name}
                        </span>
                      )}
                      {story.story_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(story.story_date), 'MMMM d, yyyy')}
                        </span>
                      )}
                      {subjects.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          <span>{subjects.map(p => p.name).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingStory(story);
                        setShowForm(true);
                      }}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteStory.mutate(story.id)}
                      className="text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="prose prose-slate prose-invert max-w-none [&>p]:text-slate-300 [&>p]:leading-relaxed">
                  <ReactMarkdown>{story.content}</ReactMarkdown>
                </div>

                {story.tags && story.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {story.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="border-slate-700 text-slate-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center">
          <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-200 mb-2">No Stories Yet</h2>
          <p className="text-slate-400 mb-6">Start preserving your family's precious memories</p>
          <Button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
            <Plus className="w-4 h-4 mr-2" />
            Write Your First Story
          </Button>
        </div>
      )}

      <StoryForm
        open={showForm || !!editingStory}
        onClose={() => {
          setShowForm(false);
          setEditingStory(null);
        }}
        story={editingStory}
        people={people}
      />
    </div>
  </ParentalGate>);
}

function StoryForm({ open, onClose, story, people }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: story?.title || "",
    content: story?.content || "",
    story_date: story?.story_date || "",
    author_person_id: story?.author_person_id || "",
    related_person_ids: story?.related_person_ids || [],
    tags: story?.tags || [],
  });
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (story?.id) {
      await base44.entities.FamilyStory.update(story.id, formData);
    } else {
      await base44.entities.FamilyStory.create(formData);
    }

    queryClient.invalidateQueries(['familyStories']);
    setLoading(false);
    onClose();
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100">{story ? 'Edit Story' : 'New Family Story'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              placeholder="The day we..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Story Content *</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100 min-h-[200px]"
              placeholder="Write your story here... (Markdown supported)"
              required
            />
            <p className="text-xs text-slate-400">You can use markdown for formatting</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Date</Label>
              <Input
                type="date"
                value={formData.story_date}
                onChange={(e) => setFormData({ ...formData, story_date: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Author</Label>
              <Select
                value={formData.author_person_id}
                onValueChange={(value) => setFormData({ ...formData, author_person_id: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue placeholder="Select author" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {people.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">People in This Story</Label>
            <Select
              value=""
              onValueChange={(value) => {
                if (!formData.related_person_ids.includes(value)) {
                  setFormData({ ...formData, related_person_ids: [...formData.related_person_ids, value] });
                }
              }}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Add person" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {people.filter(p => !formData.related_person_ids.includes(p.id)).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              {formData.related_person_ids.map(id => {
                const person = people.find(p => p.id === id);
                return (
                  <Badge key={id} className="bg-slate-700 text-slate-200">
                    {person?.name}
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        related_person_ids: formData.related_person_ids.filter(pid => pid !== id)
                      })}
                      className="ml-1"
                    >
                      ×
                    </button>
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Tags</Label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag"
                className="bg-slate-800 border-slate-700 text-slate-100"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} variant="outline" className="border-slate-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="border-slate-700 text-slate-300">
                  {tag}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tags: formData.tags.filter((_, idx) => idx !== i) })}
                    className="ml-1"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400">
              Cancel
            </Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
              {loading ? "Saving..." : (story ? "Update Story" : "Create Story")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
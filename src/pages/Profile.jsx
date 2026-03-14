import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useMyPerson } from "@/hooks/useMyPerson";
import { User, Sparkles, AlertCircle, Shield, Eye, EyeOff, Globe, Users, Lock, Heart, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import PersonForm from "@/components/family/PersonForm";
import PendingRelationships from "@/components/family/PendingRelationships";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRIVACY_LEVELS = [
  { value: 'public', label: 'Public', icon: Globe, description: 'Visible to everyone' },
  { value: 'family_only', label: 'Family Only', icon: Users, description: 'Only family members can see' },
  { value: 'private', label: 'Private', icon: Lock, description: 'Only you can see' },
];

function PrivacyVisibilitySection({ myProfile, people, queryClient, userId }) {
  const currentPrivacy = myProfile.privacy_level || 'family_only';

  const { data: relationships = [], isLoading: loadingRelationships } = useQuery({
    queryKey: ['relationships', myProfile.id],
    queryFn: () => base44.entities.Relationship.filter({ person_id: myProfile.id }),
    enabled: !!myProfile.id,
  });

  const { data: reverseRelationships = [] } = useQuery({
    queryKey: ['reverse-relationships', myProfile.id],
    queryFn: () => base44.entities.Relationship.filter({ related_person_id: myProfile.id }),
    enabled: !!myProfile.id,
  });

  const allRelationshipsMerged = [
    ...relationships,
    ...reverseRelationships.filter(rr => !relationships.some(r => r.id === rr.id)),
  ];
  const seenPersonIds = new Set();
  const allRelationships = allRelationshipsMerged.filter((rel) => {
    const otherId = rel.person_id === myProfile.id ? rel.related_person_id : rel.person_id;
    if (seenPersonIds.has(otherId)) return false;
    seenPersonIds.add(otherId);
    return true;
  });

  const { data: visibilityRows = [] } = useQuery({
    queryKey: ['relationship-visibility', userId],
    queryFn: () => base44.entities.RelationshipVisibility.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const updatePrivacy = useMutation({
    mutationFn: (level) => base44.entities.Person.update(myProfile.id, { privacy_level: level }),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-person']);
      queryClient.invalidateQueries(['people']);
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ relationshipId, currentlyVisible }) => {
      const existing = visibilityRows.find(v => v.relationship_id === relationshipId);
      if (existing) {
        return base44.entities.RelationshipVisibility.update(existing.id, { is_visible: !currentlyVisible });
      } else {
        return base44.entities.RelationshipVisibility.create({
          user_id: userId,
          relationship_id: relationshipId,
          is_visible: false,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['relationship-visibility']);
    },
  });

  const getVisibility = (relationshipId) => {
    const row = visibilityRows.find(v => v.relationship_id === relationshipId);
    return row ? row.is_visible : true;
  };

  const getRelatedPersonName = (rel) => {
    const relatedId = rel.person_id === myProfile.id ? rel.related_person_id : rel.person_id;
    const person = people.find(p => p.id === relatedId);
    return person?.name || 'Unknown';
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
        <Shield className="w-5 h-5 text-amber-400" />
        Privacy & Visibility
      </h3>

      <div className="mb-8">
        <p className="text-sm text-slate-400 mb-4">Control who can see your profile information</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRIVACY_LEVELS.map(({ value, label, icon: Icon, description }) => (
            <button
              key={value}
              onClick={() => updatePrivacy.mutate(value)}
              disabled={updatePrivacy.isPending}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                currentPrivacy === value
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="font-medium text-sm">{label}</span>
              <span className="text-xs opacity-70 text-center">{description}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-slate-400 mb-4">Choose which relationships are visible on your profile</p>
        {loadingRelationships ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : allRelationships.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No relationships found</p>
        ) : (
          <div className="space-y-2">
            {allRelationships.map((rel) => {
              const isVisible = getVisibility(rel.id);
              return (
                <div
                  key={rel.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/30"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-sm text-slate-200">{getRelatedPersonName(rel)}</span>
                      <span className="text-xs text-slate-500 ml-2 capitalize">{rel.relationship_type}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleVisibility.mutate({ relationshipId: rel.id, currentlyVisible: isVisible })}
                    disabled={toggleVisibility.isPending}
                    className={`gap-2 ${
                      isVisible
                        ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                        : 'text-slate-500 hover:text-slate-400 hover:bg-slate-700/50'
                    }`}
                  >
                    {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    {isVisible ? 'Visible' : 'Hidden'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: households = [] } = useQuery({
    queryKey: ['households'],
    queryFn: () => base44.entities.Household.list(),
  });

  const { data: myProfile, isLoading: loadingProfile } = useMyPerson();

  const { data: memorialStatus } = useQuery({
    queryKey: ['memorial-status', myProfile?.id],
    queryFn: async () => {
      const res = await fetch(`/api/memorial/status/${myProfile.id}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!myProfile?.id,
  });

  const initiateMemorial = useMutation({
    mutationFn: async (personId) => {
      const res = await fetch(`/api/memorial/initiate/${personId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to initiate memorial');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['memorial-status']);
      queryClient.invalidateQueries(['people']);
      queryClient.invalidateQueries(['my-person']);
    },
  });

  const isMemorial = myProfile?.is_memorial;

  const linkProfile = useMutation({
    mutationFn: async (personId) => {
      await base44.entities.Person.update(personId, {
        user_id: user.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['people']);
      queryClient.invalidateQueries(['my-person']);
    }
  });

  if (!user || loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!myProfile) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="glass-card rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Connect Your Profile</h2>
          <p className="text-slate-400 mb-6">
            Select which family member profile belongs to you
          </p>
          <div className="space-y-3">
            {people.filter(p => !p.user_id).map(person => (
              <Button
                key={person.id}
                onClick={() => linkProfile.mutate(person.id)}
                className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-slate-100"
              >
                <User className="w-4 h-4 mr-3" />
                {person.name} {person.nickname && `"${person.nickname}"`}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isMemorial && (
        <div className="glass-card rounded-2xl p-6 border border-indigo-500/30 bg-indigo-950/30">
          <div className="flex items-center gap-3 mb-3">
            <Heart className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-semibold text-indigo-200">In Loving Memory</h2>
          </div>
          <p className="text-indigo-300">
            {myProfile.name}
            {myProfile.birth_date && <span> &middot; Born {new Date(myProfile.birth_date.split('T')[0] + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>}
            {memorialStatus?.memorial_date && <span> &middot; Passed {new Date(memorialStatus.memorial_date).toLocaleDateString()}</span>}
          </p>
        </div>
      )}

      {/* Profile Header */}
      <div className="glass-card rounded-2xl p-8">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-4 border-amber-400/30">
            {myProfile.photo_url ? (
              <img src={myProfile.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-medium text-slate-400">
                {myProfile.name?.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-100 mb-2">{myProfile.name}</h1>
            {myProfile.nickname && (
              <p className="text-xl text-amber-300 mb-2">"{myProfile.nickname}"</p>
            )}
            <p className="text-slate-400">{user.email}</p>
            {!isMemorial && (
              <Button
                onClick={() => setShowEditDialog(true)}
                className="mt-4 bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </div>

      {!isMemorial && memorialStatus?.is_trusted_contact && (
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100 mb-1">Memorial</h3>
              {memorialStatus.confirmations?.length > 0 && !memorialStatus.already_confirmed ? (
                <p className="text-sm text-slate-400">
                  Memorial initiated &middot; {memorialStatus.confirmations.length} confirmation(s) received
                </p>
              ) : memorialStatus.already_confirmed ? (
                <p className="text-sm text-slate-400">
                  You have confirmed this memorial &middot; {memorialStatus.confirmations.length} confirmation(s) total
                </p>
              ) : (
                <p className="text-sm text-slate-400">As a trusted contact, you can report a passing</p>
              )}
            </div>
            {!memorialStatus.already_confirmed && (
              <Button
                onClick={() => initiateMemorial.mutate(myProfile.id)}
                disabled={initiateMemorial.isPending}
                variant="outline"
                className="border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20"
              >
                {initiateMemorial.isPending ? 'Submitting...' : 'Report Passing'}
              </Button>
            )}
          </div>
        </div>
      )}

      <PendingRelationships />

      {/* Profile Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Basic Info</h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-slate-500">Role:</span>
              <span className="text-slate-200 ml-2 capitalize">{myProfile.role_type}</span>
            </div>
            {myProfile.birth_date && (
              <div>
                <span className="text-slate-500">Birth Date:</span>
                <span className="text-slate-200 ml-2">{new Date(myProfile.birth_date.split('T')[0] + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            )}
            {myProfile.household_id && (
              <div>
                <span className="text-slate-500">Galaxy:</span>
                <span className="text-slate-200 ml-2">
                  {households.find(h => h.id === myProfile.household_id)?.name || "Unknown"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            My Star
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-500">Pattern:</span>
              <span className="text-slate-200 ml-2 capitalize">{myProfile.star_pattern || 'classic'}</span>
            </div>
            <div>
              <span className="text-slate-500">Brightness:</span>
              <span className="text-slate-200 ml-2">{myProfile.star_intensity || 5}/10</span>
            </div>
            <div>
              <span className="text-slate-500">Light Rays:</span>
              <span className="text-slate-200 ml-2">{myProfile.star_flare_count || 8}</span>
            </div>
          </div>
        </div>
      </div>

      {myProfile.about && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-3">About</h3>
          <p className="text-slate-300">{myProfile.about}</p>
        </div>
      )}

      {myProfile.social_links && Object.keys(myProfile.social_links).length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-400" />
            Social Accounts
          </h3>
          <div className="space-y-2">
            {Object.entries(myProfile.social_links).map(([platform, value]) => {
              const labels = { facebook: 'Facebook', twitter: 'X (Twitter)', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube' };
              const prefixes = { facebook: 'https://facebook.com/', twitter: 'https://x.com/', instagram: 'https://instagram.com/', linkedin: 'https://linkedin.com/in/', tiktok: 'https://tiktok.com/@', youtube: 'https://youtube.com/@' };
              const url = value.startsWith('http') ? value : `${prefixes[platform] || ''}${value.replace(/^@/, '')}`;
              return (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:border-amber-500/30 transition-colors group"
                >
                  <span className="text-sm font-medium text-slate-400 min-w-[90px]">{labels[platform] || platform}</span>
                  <span className="text-sm text-amber-300 flex-1 truncate">{value}</span>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {(myProfile.allergies?.length > 0 || myProfile.dietary_preferences?.length > 0) && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Health & Dietary</h3>
          {myProfile.allergies?.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-slate-500 mb-2">Allergies:</p>
              <div className="flex flex-wrap gap-2">
                {myProfile.allergies.map((allergy, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm border border-red-500/30">
                    {allergy}
                  </span>
                ))}
              </div>
            </div>
          )}
          {myProfile.dietary_preferences?.length > 0 && (
            <div>
              <p className="text-sm text-slate-500 mb-2">Dietary Preferences:</p>
              <div className="flex flex-wrap gap-2">
                {myProfile.dietary_preferences.map((pref, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-sm">
                    {pref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <PrivacyVisibilitySection myProfile={myProfile} people={people} queryClient={queryClient} userId={user?.id} />

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit Your Profile</DialogTitle>
          </DialogHeader>
          <PersonForm
            person={myProfile}
            households={households}
            people={people}
            onSuccess={() => {
              setShowEditDialog(false);
              queryClient.invalidateQueries(['people']);
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
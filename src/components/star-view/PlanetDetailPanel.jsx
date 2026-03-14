import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, Flame, Camera, Users, Heart, Calendar, Star, ArrowLeft, HeartHandshake, BookOpen, MapPin, Compass, Send, Inbox, ChevronDown, ChevronUp, Clock } from "lucide-react";

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return null;
  return `${diff} days away`;
}

function EssenceDetail({ data, personName }) {
  const essence = data?.essence;
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-6">
      {essence ? (
        <div className="max-w-md text-center space-y-6">
          <Flame className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
          <blockquote className="text-2xl md:text-3xl text-slate-100 italic leading-relaxed font-light">
            "{essence}"
          </blockquote>
          {personName && (
            <p className="text-sm text-amber-400/60 uppercase tracking-[0.2em]">- {personName}</p>
          )}
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-amber-500/5 border border-amber-500/15 flex items-center justify-center mx-auto animate-pulse">
            <Flame className="w-12 h-12 text-amber-400/30" />
          </div>
          <p className="text-xl text-slate-400 italic">This star's essence is still forming...</p>
          <p className="text-sm text-slate-500">
            {personName ? `What defines ${personName}?` : "Everyone has a story. This one is waiting to be told."}
          </p>
        </div>
      )}
    </div>
  );
}

function MomentDetail({ data, personName }) {
  const moments = data?.moments || [];
  return (
    <div className="space-y-6 px-2">
      <div className="flex items-center gap-2 text-sky-400">
        <Camera className="w-5 h-5" />
        <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Moments</h3>
        {moments.length > 0 && (
          <span className="text-xs text-slate-500 ml-auto">{moments.length} captured</span>
        )}
      </div>
      {moments.length > 0 ? (
        <div className="space-y-4">
          {moments.map((m, i) => (
            <div key={m.id || i} className="rounded-2xl overflow-hidden border border-sky-500/15 bg-slate-800/40 hover:border-sky-500/25 transition-colors">
              {m.media_urls?.length > 0 && (
                <img src={m.media_urls[0]} alt="" className="w-full max-h-64 object-cover" />
              )}
              {m.content && (
                <div className="p-4">
                  <p className="text-base text-slate-200 leading-relaxed">{m.content}</p>
                </div>
              )}
              <div className="px-4 pb-3 flex items-center gap-2">
                {m.author_name && (
                  <span className="text-xs text-sky-400/50">{m.author_name}</span>
                )}
                {(m.created_at || m.captured_date) && (
                  <span className="text-xs text-slate-600 ml-auto">{formatDate(m.created_at || m.captured_date)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-sky-500/5 border border-sky-500/15 flex items-center justify-center mb-5 animate-pulse">
            <Camera className="w-12 h-12 text-sky-400/30" />
          </div>
          <p className="text-lg text-slate-400 italic">No moments captured yet</p>
          <p className="text-sm text-slate-500 mt-2">
            {personName ? `Share a memory of ${personName}` : "Every family has stories waiting to be shared"}
          </p>
        </div>
      )}
    </div>
  );
}

function FamilyDetail({ data, personName }) {
  const navigate = useNavigate();
  const members = data?.familyMembers || [];
  const groupByType = {};
  members.forEach(m => {
    const type = m.relType || "family";
    if (!groupByType[type]) groupByType[type] = [];
    groupByType[type].push(m);
  });

  const typeOrder = ["spouse", "partner", "parent", "child", "sibling"];
  const sortedEntries = Object.entries(groupByType).sort(([a], [b]) => {
    const ai = typeOrder.indexOf(a);
    const bi = typeOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="space-y-6 px-2">
      <div className="flex items-center gap-2 text-emerald-400">
        <Users className="w-5 h-5" />
        <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Family</h3>
        {members.length > 0 && (
          <span className="text-xs text-slate-500 ml-auto">{members.length} connections</span>
        )}
      </div>
      {members.length > 0 ? (
        <div className="space-y-5">
          {sortedEntries.map(([type, groupMembers]) => (
            <div key={type}>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/60 mb-2 pl-1">
                {type === "spouse" || type === "partner" ? "Partner" : type.replace(/_/g, " ")}
                {groupMembers.length > 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                {groupMembers.map((member, i) => (
                  <a
                    key={i}
                    href={`/star/${member.id}`}
                    className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/40 border border-emerald-500/10 hover:border-emerald-500/25 hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/star/${member.id}`);
                    }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-emerald-500/30 group-hover:border-emerald-400/50 transition-colors"
                      style={{ background: member.photo_url ? "transparent" : "#065f46" }}
                    >
                      {member.photo_url ? (
                        <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-semibold text-emerald-300">{member.name?.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium text-slate-200 truncate group-hover:text-emerald-200 transition-colors">{member.name}</p>
                      {member.nickname && (
                        <p className="text-xs text-emerald-400/50">"{member.nickname}"</p>
                      )}
                    </div>
                    <ArrowLeft className="w-4 h-4 text-slate-700 group-hover:text-emerald-400/50 transition-colors rotate-180" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-center mb-5 animate-pulse">
            <Users className="w-12 h-12 text-emerald-400/30" />
          </div>
          <p className="text-lg text-slate-400 italic">No family connections yet</p>
          <p className="text-sm text-slate-500 mt-2">
            {personName ? `Connect family members to ${personName}` : "Family connections will appear here"}
          </p>
        </div>
      )}
    </div>
  );
}

function InterestDetail({ data, personName }) {
  const interests = data?.interests || [];
  return (
    <div className="space-y-6 px-2">
      <div className="flex items-center gap-2 text-rose-400">
        <Heart className="w-5 h-5" />
        <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Interests</h3>
        {interests.length > 0 && (
          <span className="text-xs text-slate-500 ml-auto">{interests.length} interests</span>
        )}
      </div>
      {interests.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {interests.map((interest, i) => {
            const name = typeof interest === "string" ? interest : interest.name || interest;
            const icon = typeof interest === "object" ? interest.icon : null;
            const color = typeof interest === "object" ? interest.color : "#f472b6";
            return (
              <div
                key={i}
                className="flex items-center gap-3 p-5 rounded-xl border transition-all hover:scale-[1.02]"
                style={{
                  borderColor: `${color}30`,
                  background: `${color}08`,
                }}
              >
                {icon && <span className="text-3xl">{icon}</span>}
                <span className="text-base font-medium text-slate-200">{name}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-rose-500/5 border border-rose-500/15 flex items-center justify-center mb-5 animate-pulse">
            <Heart className="w-12 h-12 text-rose-400/30" />
          </div>
          <p className="text-lg text-slate-400 italic">Interests not shared yet</p>
          <p className="text-sm text-slate-500 mt-2">
            {personName ? `What lights up ${personName}'s world?` : "Passions and hobbies will appear here"}
          </p>
        </div>
      )}
    </div>
  );
}

function EventDetail({ data, personName }) {
  const { nextEvent, birthday, allEvents } = data || {};
  return (
    <div className="space-y-6 px-2">
      <div className="flex items-center gap-2 text-violet-400">
        <Calendar className="w-5 h-5" />
        <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Events & Milestones</h3>
      </div>
      <div className="space-y-4">
        {birthday && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">🎂</span>
              </div>
              <div className="flex-1">
                <p className="text-lg font-medium text-slate-200">Birthday</p>
                <p className="text-sm text-violet-400/80">{formatDate(birthday.date)}</p>
                {daysUntil(birthday.date) && (
                  <p className="text-xs text-violet-300 mt-1 font-medium">{daysUntil(birthday.date)}</p>
                )}
                {birthday.turningAge && (
                  <p className="text-xs text-slate-500 mt-1">Turning {birthday.turningAge}</p>
                )}
              </div>
            </div>
          </div>
        )}
        {nextEvent && (
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <p className="text-base font-medium text-slate-200">{nextEvent.title || "Upcoming Event"}</p>
                <p className="text-sm text-slate-500">{formatDate(nextEvent.date)}</p>
                {daysUntil(nextEvent.date) && (
                  <p className="text-xs text-violet-300 mt-0.5">{daysUntil(nextEvent.date)}</p>
                )}
              </div>
            </div>
          </div>
        )}
        {allEvents && allEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-violet-400/60 pl-1">All Events</p>
            {allEvents.map((evt, i) => (
              <div key={evt.id || i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/20">
                <Calendar className="w-4 h-4 text-violet-400/50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 truncate">{evt.title}</p>
                  <p className="text-xs text-slate-600">{formatShortDate(evt.date)}</p>
                </div>
                {daysUntil(evt.date) && (
                  <span className="text-[10px] text-violet-400/60 flex-shrink-0">{daysUntil(evt.date)}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {!birthday && !nextEvent && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 rounded-full bg-violet-500/5 border border-violet-500/15 flex items-center justify-center mb-5 animate-pulse">
              <Calendar className="w-12 h-12 text-violet-400/30" />
            </div>
            <p className="text-lg text-slate-400 italic">Nothing on the horizon</p>
            <p className="text-sm text-slate-500 mt-2">
              {personName ? `${personName}'s events and milestones will appear here` : "Events and milestones will appear here"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedDetail({ data }) {
  const featured = data?.featured;
  return (
    <div className="space-y-6 px-2">
      <div className="flex items-center gap-2 text-amber-300">
        <Star className="w-5 h-5" />
        <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Featured</h3>
      </div>
      {featured ? (
        <div className="space-y-4">
          {featured.media_urls && featured.media_urls.length > 0 && (
            <div className="rounded-2xl overflow-hidden border border-amber-500/20">
              <img src={featured.media_urls[0]} alt="" className="w-full max-h-72 object-cover" />
            </div>
          )}
          {featured.content && (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-amber-500/10">
              <p className="text-base text-slate-200 leading-relaxed">{featured.content}</p>
              {featured.created_at && (
                <p className="text-xs text-slate-600 mt-3">{formatDate(featured.created_at)}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-amber-500/5 border border-amber-500/15 flex items-center justify-center mb-5 animate-pulse">
            <Star className="w-12 h-12 text-amber-400/30" />
          </div>
          <p className="text-lg text-slate-400 italic">Nothing featured yet</p>
          <p className="text-sm text-slate-500 mt-2">Highlights and favorite things will appear here</p>
        </div>
      )}
    </div>
  );
}

function LoveNoteDetail({ data, personName }) {
  const received = data?.received || [];
  const sent = data?.sent || [];
  const hasNotes = received.length > 0 || sent.length > 0;

  return (
    <div className="space-y-6 px-2">
      <div className="flex items-center gap-2 text-pink-400">
        <HeartHandshake className="w-5 h-5" />
        <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Love Notes</h3>
        {hasNotes && (
          <span className="text-xs text-slate-500 ml-auto">{received.length + sent.length} notes</span>
        )}
      </div>
      {hasNotes ? (
        <div className="space-y-6">
          {received.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-pink-400/60">
                <Inbox className="w-3.5 h-3.5" />
                <p className="text-[10px] uppercase tracking-[0.2em]">Received</p>
              </div>
              {received.map((note, i) => (
                <div key={note.id || i} className="p-4 rounded-xl bg-slate-800/40 border border-pink-500/15 hover:border-pink-500/25 transition-colors">
                  <p className="text-base text-slate-200 leading-relaxed italic">"{note.content}"</p>
                  <div className="flex items-center gap-2 mt-3">
                    <HeartHandshake className="w-3 h-3 text-pink-400/50" />
                    <p className="text-xs text-pink-400/60">
                      From {note.from_name || "Someone special"}
                    </p>
                    {note.created_date && (
                      <span className="text-xs text-slate-600 ml-auto">{formatDate(note.created_date)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {sent.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-pink-400/60">
                <Send className="w-3.5 h-3.5" />
                <p className="text-[10px] uppercase tracking-[0.2em]">Sent</p>
              </div>
              {sent.map((note, i) => (
                <div key={note.id || i} className="p-4 rounded-xl bg-slate-800/40 border border-pink-500/10 hover:border-pink-500/20 transition-colors">
                  <p className="text-base text-slate-200 leading-relaxed italic">"{note.content}"</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Send className="w-3 h-3 text-pink-400/40" />
                    <p className="text-xs text-pink-400/50">
                      To {note.to_name || "Someone special"}
                    </p>
                    {note.created_date && (
                      <span className="text-xs text-slate-600 ml-auto">{formatDate(note.created_date)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-pink-500/5 border border-pink-500/15 flex items-center justify-center mb-5 animate-pulse">
            <HeartHandshake className="w-12 h-12 text-pink-400/30" />
          </div>
          <p className="text-lg text-slate-400 italic">No love notes yet</p>
          <p className="text-sm text-slate-500 mt-2">
            {personName ? `Send ${personName} a love note` : "Words of love are waiting to be shared"}
          </p>
        </div>
      )}
    </div>
  );
}

function StoryDetail({ data, personName }) {
  const stories = data?.stories || [];
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="space-y-6 px-2">
      <div className="flex items-center gap-2 text-indigo-400">
        <BookOpen className="w-5 h-5" />
        <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Family Stories</h3>
        {stories.length > 0 && (
          <span className="text-xs text-slate-500 ml-auto">{stories.length} stories</span>
        )}
      </div>
      {stories.length > 0 ? (
        <div className="space-y-4">
          {stories.map((story, i) => {
            const isExpanded = expandedId === (story.id || i);
            return (
              <div
                key={story.id || i}
                className="rounded-xl bg-slate-800/40 border border-indigo-500/15 hover:border-indigo-500/25 transition-colors overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : (story.id || i))}
                  className="w-full p-4 text-left flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-slate-200">{story.title || "Untitled Story"}</p>
                    {story.era && (
                      <p className="text-xs text-indigo-400/60 mt-0.5">{story.era}</p>
                    )}
                    {!isExpanded && story.content && (
                      <p className="text-sm text-slate-400 mt-2 line-clamp-2">{story.content}</p>
                    )}
                    {story.author_name && (
                      <p className="text-xs text-slate-500 mt-2">By {story.author_name}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-indigo-400/50" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-indigo-400/50" />
                    )}
                  </div>
                </button>
                {isExpanded && story.content && (
                  <div className="px-4 pb-4 pt-0 ml-13">
                    <div className="border-t border-indigo-500/10 pt-3">
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{story.content}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-indigo-500/5 border border-indigo-500/15 flex items-center justify-center mb-5 animate-pulse">
            <BookOpen className="w-12 h-12 text-indigo-400/30" />
          </div>
          <p className="text-lg text-slate-400 italic">No stories told yet</p>
          <p className="text-sm text-slate-500 mt-2">
            {personName ? `Tell a story about ${personName}` : "Every family has stories worth telling"}
          </p>
        </div>
      )}
    </div>
  );
}

function TripDetailView({ data, personName }) {
  const trips = data?.trips || [];
  const now = new Date();

  const upcoming = trips.filter(t => t.start_date && new Date(t.start_date) >= now);
  const past = trips.filter(t => t.start_date && new Date(t.start_date) < now);

  const renderTrip = (trip, i) => (
    <div key={trip.id || i} className="p-4 rounded-xl bg-slate-800/40 border border-teal-500/15 hover:border-teal-500/25 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
          <Compass className="w-5 h-5 text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-slate-200">{trip.name || "Untitled Trip"}</p>
          {trip.location && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-teal-400/60" />
              <p className="text-sm text-teal-400/70">{trip.location}</p>
            </div>
          )}
          <div className="flex items-center gap-1 mt-1.5">
            <Clock className="w-3 h-3 text-slate-500" />
            <p className="text-xs text-slate-500">
              {trip.start_date ? formatShortDate(trip.start_date) : "TBD"}
              {trip.end_date ? ` - ${formatShortDate(trip.end_date)}` : ""}
            </p>
          </div>
          {trip.status && (
            <span className={`inline-block mt-2 text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border ${
              trip.status === "completed" ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" :
              trip.status === "active" || trip.status === "in_progress" ? "text-teal-400 border-teal-500/20 bg-teal-500/5" :
              "text-slate-400 border-slate-500/20 bg-slate-500/5"
            }`}>
              {trip.status.replace(/_/g, " ")}
            </span>
          )}
          {trip.participants && trip.participants.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/30">
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-2">Participants</p>
              <div className="flex flex-wrap gap-1.5">
                {trip.participants.map((p, j) => (
                  <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300/70 border border-teal-500/15">
                    {p.name || p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 px-2">
      <div className="flex items-center gap-2 text-teal-400">
        <Compass className="w-5 h-5" />
        <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Trips & Adventures</h3>
        {trips.length > 0 && (
          <span className="text-xs text-slate-500 ml-auto">{trips.length} trips</span>
        )}
      </div>
      {trips.length > 0 ? (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-teal-400/60 pl-1">Upcoming</p>
              {upcoming.map(renderTrip)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-teal-400/60 pl-1">Past Adventures</p>
              {past.map(renderTrip)}
            </div>
          )}
          {upcoming.length === 0 && past.length === 0 && trips.map(renderTrip)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-teal-500/5 border border-teal-500/15 flex items-center justify-center mb-5 animate-pulse">
            <Compass className="w-12 h-12 text-teal-400/30" />
          </div>
          <p className="text-lg text-slate-400 italic">No adventures yet</p>
          <p className="text-sm text-slate-500 mt-2">
            {personName ? `Plan an adventure with ${personName}` : "Plan a trip and make some memories"}
          </p>
        </div>
      )}
    </div>
  );
}

const DETAIL_RENDERERS = {
  essence: EssenceDetail,
  moment: MomentDetail,
  family: FamilyDetail,
  interest: InterestDetail,
  event: EventDetail,
  featured: FeaturedDetail,
  lovenote: LoveNoteDetail,
  story: StoryDetail,
  trip: TripDetailView,
};

const TYPE_TITLES = {
  essence: "Essence",
  moment: "Moments",
  family: "Family",
  interest: "Interests",
  event: "Events",
  featured: "Featured",
  lovenote: "Love Notes",
  story: "Stories",
  trip: "Trips",
};

const TYPE_ACCENT_COLORS = {
  essence: { border: "rgba(251, 191, 36, 0.15)", glow: "rgba(251, 191, 36, 0.06)", text: "#fbbf24" },
  moment: { border: "rgba(56, 189, 248, 0.15)", glow: "rgba(56, 189, 248, 0.06)", text: "#38bdf8" },
  family: { border: "rgba(52, 211, 153, 0.15)", glow: "rgba(52, 211, 153, 0.06)", text: "#34d399" },
  interest: { border: "rgba(244, 114, 182, 0.15)", glow: "rgba(244, 114, 182, 0.06)", text: "#f472b6" },
  event: { border: "rgba(167, 139, 250, 0.15)", glow: "rgba(167, 139, 250, 0.06)", text: "#a78bfa" },
  featured: { border: "rgba(251, 191, 36, 0.15)", glow: "rgba(251, 191, 36, 0.06)", text: "#fbbf24" },
  lovenote: { border: "rgba(236, 72, 153, 0.15)", glow: "rgba(236, 72, 153, 0.06)", text: "#ec4899" },
  story: { border: "rgba(129, 140, 248, 0.15)", glow: "rgba(129, 140, 248, 0.06)", text: "#818cf8" },
  trip: { border: "rgba(45, 212, 191, 0.15)", glow: "rgba(45, 212, 191, 0.06)", text: "#2dd4bf" },
};

export default function PlanetDetailPanel({ planet, onClose, personName }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!planet) return null;

  const DetailComponent = DETAIL_RENDERERS[planet.type] || FeaturedDetail;
  const accent = TYPE_ACCENT_COLORS[planet.type] || TYPE_ACCENT_COLORS.featured;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100dvh",
        zIndex: 99999,
        background: "rgb(2, 6, 23)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div className="flex items-center px-3 sm:px-4 py-2.5 sm:py-3 border-b flex-shrink-0" style={{ borderColor: accent.border }}>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-slate-800/80 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 transition-colors" style={{ color: accent.text }} />
          <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100 transition-colors">
            Back
          </span>
        </button>
        <div className="flex-1 flex justify-center">
          <div className="text-[10px] uppercase tracking-[0.15em] font-medium px-3 py-1 rounded-full border"
            style={{ color: accent.text, borderColor: accent.border }}
          >
            {TYPE_TITLES[planet.type] || "Detail"}
          </div>
        </div>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-2xl mx-auto py-6 sm:py-8 px-3 sm:px-4">
          <DetailComponent data={planet.data} personName={personName} />
        </div>
      </div>
    </div>,
    document.body
  );
}

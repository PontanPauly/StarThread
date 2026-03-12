import React from "react";
import { User, Heart, Camera, Users, Calendar, BookOpen } from "lucide-react";

const ORBIT_CONFIGS = [
  { radius: 220, duration: 60, startAngle: 0 },
  { radius: 220, duration: 60, startAngle: 60 },
  { radius: 220, duration: 60, startAngle: 120 },
  { radius: 220, duration: 60, startAngle: 180 },
  { radius: 220, duration: 60, startAngle: 240 },
  { radius: 220, duration: 60, startAngle: 300 },
];

const MOBILE_ORBIT_CONFIGS = [
  { radius: 150, duration: 60, startAngle: 0 },
  { radius: 150, duration: 60, startAngle: 60 },
  { radius: 150, duration: 60, startAngle: 120 },
  { radius: 150, duration: 60, startAngle: 180 },
  { radius: 150, duration: 60, startAngle: 240 },
  { radius: 150, duration: 60, startAngle: 300 },
];

function OrbitingCard({ children, config, index, isMobile }) {
  const cfg = isMobile ? MOBILE_ORBIT_CONFIGS[index % MOBILE_ORBIT_CONFIGS.length] : ORBIT_CONFIGS[index % ORBIT_CONFIGS.length];
  const cardSize = isMobile ? 100 : 140;

  return (
    <div
      className="absolute"
      style={{
        width: `${cardSize}px`,
        height: `${cardSize}px`,
        left: "50%",
        top: "50%",
        marginLeft: `-${cardSize / 2}px`,
        marginTop: `-${cardSize / 2}px`,
        animation: `orbit-${index} ${cfg.duration}s linear infinite`,
      }}
    >
      <style>{`
        @keyframes orbit-${index} {
          from {
            transform: rotate(${cfg.startAngle}deg) translateX(${cfg.radius}px) rotate(-${cfg.startAngle}deg);
          }
          to {
            transform: rotate(${cfg.startAngle + 360}deg) translateX(${cfg.radius}px) rotate(-${cfg.startAngle + 360}deg);
          }
        }
      `}</style>
      <div className="w-full h-full rounded-xl bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 p-3 flex flex-col items-center justify-center text-center hover:border-amber-400/50 hover:bg-slate-800/90 transition-all cursor-default shadow-lg shadow-black/20">
        {children}
      </div>
    </div>
  );
}

export default function OrbitingCards({ person, relationships, people, moments, calendarEvents, isMobile }) {
  const cards = [];

  if (person.about) {
    cards.push({
      key: "about",
      icon: <BookOpen className="w-4 h-4 text-amber-400 mb-1 flex-shrink-0" />,
      title: "About",
      content: person.about.length > 60 ? person.about.slice(0, 60) + "…" : person.about,
    });
  }

  const starProfile = person.star_profile || {};
  const interests = starProfile.interests || starProfile.hobbies || [];
  if (interests.length > 0) {
    cards.push({
      key: "interests",
      icon: <Heart className="w-4 h-4 text-rose-400 mb-1 flex-shrink-0" />,
      title: "Interests",
      content: (Array.isArray(interests) ? interests : [interests]).slice(0, 3).map(i => typeof i === "string" ? i : i.name || i).join(", "),
    });
  }

  const personMoments = moments.filter(
    (m) => m.author_person_id === person.id || (m.tagged_person_ids && m.tagged_person_ids.includes(person.id))
  );
  cards.push({
    key: "moments",
    icon: <Camera className="w-4 h-4 text-blue-400 mb-1 flex-shrink-0" />,
    title: "Moments",
    content: `${personMoments.length} moment${personMoments.length !== 1 ? "s" : ""} captured`,
  });

  const connectionCount = relationships.length;
  const connectionTypes = [...new Set(relationships.map((r) => r.relationship_type))];
  cards.push({
    key: "connections",
    icon: <Users className="w-4 h-4 text-emerald-400 mb-1 flex-shrink-0" />,
    title: "Connections",
    content: `${connectionCount} family connection${connectionCount !== 1 ? "s" : ""}`,
  });

  const personEvents = calendarEvents.filter(
    (e) => e.person_ids && e.person_ids.includes(person.id)
  );
  if (personEvents.length > 0) {
    const nextEvent = personEvents
      .filter((e) => new Date(e.date) >= new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    cards.push({
      key: "events",
      icon: <Calendar className="w-4 h-4 text-violet-400 mb-1 flex-shrink-0" />,
      title: "Events",
      content: nextEvent ? nextEvent.title : `${personEvents.length} event${personEvents.length !== 1 ? "s" : ""}`,
    });
  }

  if (person.birth_date) {
    const birthDate = new Date(person.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    cards.push({
      key: "birthday",
      icon: <User className="w-4 h-4 text-amber-300 mb-1 flex-shrink-0" />,
      title: "Age",
      content: `${age} years old`,
    });
  }

  const displayCards = cards.slice(0, 6);

  return (
    <>
      {displayCards.map((card, index) => (
        <OrbitingCard key={card.key} config={ORBIT_CONFIGS[index]} index={index} isMobile={isMobile}>
          {card.icon}
          <span className="text-xs font-semibold text-slate-200 mb-0.5">{card.title}</span>
          <span className="text-[10px] text-slate-400 leading-tight line-clamp-3">{card.content}</span>
        </OrbitingCard>
      ))}
    </>
  );
}

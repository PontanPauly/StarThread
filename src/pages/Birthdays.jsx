import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Cake, Gift, Calendar, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInYears, isBefore, isAfter, startOfDay, addDays } from "date-fns";

export default function Birthdays() {
  const { data: people = [], isLoading } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  // Calculate upcoming birthdays
  const birthdayData = useMemo(() => {
    const today = startOfDay(new Date());
    const upcoming = [];
    const thisMonth = [];
    
    people.forEach(person => {
      if (!person.birth_date && !person.birth_year) return;
      if (!person.birth_date) return;
      
      const birthDate = new Date(person.birth_date);
      const thisYear = today.getFullYear();
      const nextBirthday = new Date(thisYear, birthDate.getMonth(), birthDate.getDate());
      
      // If birthday passed this year, use next year
      if (isBefore(nextBirthday, today)) {
        nextBirthday.setFullYear(thisYear + 1);
      }
      
      const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
      const age = differenceInYears(nextBirthday, birthDate);
      
      const birthdayInfo = {
        person,
        nextBirthday,
        daysUntil,
        age,
        isThisMonth: nextBirthday.getMonth() === today.getMonth(),
      };
      
      if (daysUntil <= 30) {
        upcoming.push(birthdayInfo);
      }
      if (birthdayInfo.isThisMonth) {
        thisMonth.push(birthdayInfo);
      }
    });
    
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    thisMonth.sort((a, b) => a.nextBirthday - b.nextBirthday);
    
    return { upcoming, thisMonth };
  }, [people]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Cake className="w-6 h-6 text-amber-400" />
            Birthdays & Celebrations
          </h1>
          <p className="text-slate-500 mt-1">Never miss a family celebration</p>
        </div>
      </div>

      {/* Upcoming (Next 30 Days) */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-slate-100">Coming Up (Next 30 Days)</h2>
        </div>
        
        {birthdayData.upcoming.length > 0 ? (
          <div className="space-y-3">
            {birthdayData.upcoming.map(({ person, nextBirthday, daysUntil, age }) => (
              <Link
                key={person.id}
                to={`/star/${person.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700/50 group"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center overflow-hidden">
                  {person.photo_url ? (
                    <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-white">{person.name?.charAt(0)}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-100">{person.name}</h3>
                    {person.is_deceased && <Star className="w-3 h-3 text-amber-400" />}
                  </div>
                  <p className="text-sm text-slate-400">
                    {format(nextBirthday, 'MMMM d, yyyy')} · Turning {age}
                  </p>
                </div>
                
                <div className="text-right">
                  <Badge className={
                    daysUntil === 0 ? "bg-amber-500 text-white" :
                    daysUntil <= 7 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                    "bg-slate-700 text-slate-300"
                  }>
                    {daysUntil === 0 ? "Today!" : 
                     daysUntil === 1 ? "Tomorrow" : 
                     `In ${daysUntil} days`}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No birthdays in the next 30 days</p>
          </div>
        )}
      </div>

      {/* This Month */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-slate-100">This Month</h2>
        </div>
        
        {birthdayData.thisMonth.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {birthdayData.thisMonth.map(({ person, nextBirthday, age }) => (
              <Link
                key={person.id}
                to={`/star/${person.id}`}
                className="p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                    {person.photo_url ? (
                      <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-medium text-slate-400">{person.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-100 truncate">{person.name}</h3>
                    <p className="text-sm text-slate-400">{format(nextBirthday, 'MMM d')} · {age} years</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p>No birthdays this month</p>
          </div>
        )}
      </div>

      {/* All Birthdays by Month */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-slate-100">All Family Birthdays</h2>
        </div>
        
        <div className="space-y-4">
          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => {
            const monthBirthdays = people.filter(p => {
              if (!p.birth_date) return false;
              return new Date(p.birth_date).getMonth() === idx;
            }).sort((a, b) => new Date(a.birth_date).getDate() - new Date(b.birth_date).getDate());
            
            if (monthBirthdays.length === 0) return null;
            
            return (
              <div key={month}>
                <h3 className="text-sm font-semibold text-slate-400 mb-2">{month}</h3>
                <div className="space-y-2">
                  {monthBirthdays.map(person => (
                    <Link key={person.id} to={`/star/${person.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/30">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-100">{person.name}</span>
                        {person.nickname && <span className="text-sm text-slate-500">"{person.nickname}"</span>}
                      </div>
                      <span className="text-sm text-slate-400">
                        {format(new Date(person.birth_date), 'MMM d')}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(() => {
        const ancestors = people
          .filter(p => !p.birth_date && p.birth_year)
          .sort((a, b) => a.birth_year - b.birth_year);
        if (ancestors.length === 0) return null;
        return (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-slate-100">Ancestors</h2>
            </div>
            <div className="space-y-2">
              {ancestors.map(person => (
                <Link key={person.id} to={`/star/${person.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100">{person.name}</span>
                    {person.nickname && <span className="text-sm text-slate-500">"{person.nickname}"</span>}
                  </div>
                  <span className="text-sm text-slate-400">b. {person.birth_year}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
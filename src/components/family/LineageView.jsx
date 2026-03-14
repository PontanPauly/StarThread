import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function LineageView({ people, relationships, onPersonClick }) {
  const [expanded, setExpanded] = useState(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const toggleExpand = (personId) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(personId)) {
      newExpanded.delete(personId);
    } else {
      newExpanded.add(personId);
    }
    setExpanded(newExpanded);
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setExpanded(new Set());
    } else {
      const allWithChildren = people.filter(p => 
        (relationshipMap.children.get(p.id) || []).length > 0
      ).map(p => p.id);
      setExpanded(new Set(allWithChildren));
    }
    setExpandAll(!expandAll);
  };

  // Build relationship map
  const relationshipMap = useMemo(() => {
    const map = {
      parents: new Map(), // child -> [parent1, parent2]
      children: new Map(), // parent -> [child1, child2, ...]
      partners: new Map(), // person -> partner
    };

    relationships.forEach(rel => {
      if (rel.relationship_type === 'parent') {
        // rel.person_id is parent, rel.related_person_id is child
        if (!map.children.has(rel.person_id)) {
          map.children.set(rel.person_id, []);
        }
        map.children.get(rel.person_id).push(rel.related_person_id);

        if (!map.parents.has(rel.related_person_id)) {
          map.parents.set(rel.related_person_id, []);
        }
        map.parents.get(rel.related_person_id).push(rel.person_id);
      } else if (rel.relationship_type === 'partner') {
        map.partners.set(rel.person_id, rel.related_person_id);
        map.partners.set(rel.related_person_id, rel.person_id);
      }
    });

    return map;
  }, [relationships]);

  // Find root people (no parents) - suppress partner if they'll render inline under their partner
  const roots = useMemo(() => {
    const noParents = people.filter(p => !relationshipMap.parents.has(p.id));
    const rootIds = new Set(noParents.map(p => p.id));

    // If A and B are both roots and are partners, B will render inline next to A.
    // Suppress B as a standalone root to avoid duplication.
    const suppressedAsPartner = new Set();
    noParents.forEach(p => {
      if (suppressedAsPartner.has(p.id)) return;
      const partnerId = relationshipMap.partners.get(p.id);
      if (partnerId && rootIds.has(partnerId)) {
        suppressedAsPartner.add(partnerId);
      }
    });

    return noParents
      .filter(p => !suppressedAsPartner.has(p.id))
      .sort((a, b) => {
        if (a.is_deceased !== b.is_deceased) return a.is_deceased ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [people, relationshipMap]);

  const PersonNode = ({ person, level = 0, generation = 1 }) => {
    const myChildren = relationshipMap.children.get(person.id) || [];
    const partnerId = relationshipMap.partners.get(person.id);
    const partner = partnerId ? people.find(p => p.id === partnerId) : null;
    // Combine children from both partners, deduplicated
    const partnerChildren = partner ? (relationshipMap.children.get(partner.id) || []) : [];
    const allChildIds = [...new Set([...myChildren, ...partnerChildren])];
    const hasChildren = allChildIds.length > 0;
    const isExpanded = expanded.has(person.id);

    const roleColor = 
      person.role_type === 'adult' ? 'text-blue-400' :
      person.role_type === 'teen' ? 'text-purple-400' :
      person.role_type === 'child' ? 'text-green-400' :
      'text-amber-400';

    return (
      <div className="relative">
        <div 
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer group",
            level > 0 && "ml-8"
          )}
          style={{ marginLeft: level > 0 ? `${Math.min(level, 4) * 1.5}rem` : 0 }}
        >
          {/* Expand button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(person.id);
              }}
              className="text-slate-500 hover:text-slate-300"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}

          {/* Person info */}
          <div 
            className="flex items-center gap-3 flex-1"
            onClick={() => onPersonClick(person)}
          >
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
              {person.photo_url ? (
                <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-slate-400">
                  {person.name?.charAt(0)}
                </span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className={cn("font-medium", roleColor)}>{person.name}</h3>
                {partner && (
                  <>
                    <span className="text-slate-600">&</span>
                    <h3 className={cn("font-medium", roleColor)}>{partner.name}</h3>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-500">
                  {person.role_type}
                </Badge>
                {hasChildren && (
                  <span className="text-xs text-slate-600">
                    {allChildIds.length} {allChildIds.length === 1 ? 'child' : 'children'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="mt-1">
            <div className="text-xs text-slate-600 ml-8 mb-1" style={{ marginLeft: `${(level + 1) * 2}rem` }}>
              Generation {generation + 1}
            </div>
            {allChildIds.map(childId => {
              const child = people.find(p => p.id === childId);
              if (!child) return null;
              return (
                <PersonNode
                  key={child.id}
                  person={child}
                  level={level + 1}
                  generation={generation + 1}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (roots.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-200 mb-2">No Family Connections Yet</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Add relationships between family members to see the lineage tree.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Family Tree</h2>
        <button
          onClick={handleExpandAll}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          {expandAll ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
      <div className="space-y-2">
        {roots.map((person, idx) => (
          <div key={person.id}>
            {idx > 0 && <div className="my-4 border-t border-slate-800" />}
            <div className="text-xs text-slate-500 mb-2">Generation 1</div>
            <PersonNode person={person} level={0} generation={1} />
          </div>
        ))}
      </div>
    </div>
  );
}
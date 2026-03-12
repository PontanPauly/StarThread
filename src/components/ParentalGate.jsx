import React from "react";
import { useMyPerson } from "@/hooks/useMyPerson";
import { Shield } from "lucide-react";

export function useParentalGate(featureKey) {
  const { data: myPerson, isLoading } = useMyPerson();
  if (isLoading || !myPerson) return { blocked: false, loading: isLoading };
  const isTeen = myPerson.role_type === 'teen' || myPerson.role_type === 'child';
  if (!isTeen) return { blocked: false, loading: false };
  const controls = myPerson.parental_controls;
  if (!controls) return { blocked: false, loading: false };
  return { blocked: controls[featureKey] === false, loading: false };
}

export default function ParentalGate({ featureKey, children }) {
  const { blocked, loading } = useParentalGate(featureKey);

  if (loading) return null;

  if (blocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="glass-card rounded-2xl p-8 max-w-md space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Feature Restricted</h2>
          <p className="text-slate-400 text-sm">
            This feature is managed by your parent. If you'd like access, ask them to enable it in your profile settings.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

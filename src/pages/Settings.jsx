import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { 
  Settings as SettingsIcon, 
  Shield,
  User,
  FileText,
  Eye,
  EyeOff,
  LogOut,
  Download,
  Trash2,
  ExternalLink,
  Plug,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Headphones,
  Copy,
  Clock,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import MergePersonDialog from "@/components/identity/MergePersonDialog";

export default function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("security");

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-amber-400" />
          Settings
        </h1>
        <p className="text-slate-500 mt-1">Manage your account and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <TabsList className="bg-slate-800/50 border border-slate-700 w-max min-w-full">
            <TabsTrigger value="security" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <Shield className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <User className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <Plug className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="policies" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <FileText className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Policies</span>
            </TabsTrigger>
            <TabsTrigger value="beta" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-900">
              <Rocket className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Beta</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <Headphones className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Support</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="security" className="space-y-6">
          <ChangePasswordForm />

          <div className="glass-card rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-2">Sign Out</h3>
            <p className="text-sm text-slate-400 mb-4">
              Sign out of your account on this device.
            </p>
            <Button
              onClick={logout}
              variant="outline"
              className="border-slate-600 text-slate-100 hover:bg-slate-800 hover:border-slate-500"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-4">Profile Information</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-slate-400 text-xs uppercase tracking-wider">Name</Label>
                <p className="text-slate-200 mt-1">{user.full_name}</p>
              </div>
              <div>
                <Label className="text-slate-400 text-xs uppercase tracking-wider">Email</Label>
                <p className="text-slate-200 mt-1">{user.email}</p>
              </div>
              <div>
                <Label className="text-slate-400 text-xs uppercase tracking-wider">Member Since</Label>
                <p className="text-slate-200 mt-1">
                  {new Date(user.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          <ChangeEmailForm />
          <DownloadDataCard />

          <MergePersonDialog />

          <DeleteAccountCard />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <GoogleCalendarSettings />
        </TabsContent>

        <TabsContent value="policies" className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-4">Policies & Programs</h3>
            <div className="space-y-4">
              <PolicyLink
                title="Terms of Service"
                description="Read our terms and conditions for using StarThread."
                href="/policies/terms"
              />
              <PolicyLink
                title="Privacy Policy"
                description="Learn how we collect, use, and protect your personal information."
                href="/policies/privacy"
              />
              <PolicyLink
                title="Community Guidelines"
                description="Standards for respectful, safe family interactions."
                href="/policies/community"
              />
              <PolicyLink
                title="Safety Policy"
                description="How we protect you and your family, especially minors."
                href="/policies/safety"
              />
              <PolicyLink
                title="Beta Program"
                description="StarThread is currently in beta. Learn about what that means and how to provide feedback."
                href="/policies/beta"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="beta" className="space-y-6">
          <BetaProgramSection />
        </TabsContent>

        <TabsContent value="support" className="space-y-6">
          <SupportTokenSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SupportTokenSection() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchToken = async () => {
    try {
      const res = await fetch("/api/auth/support-token", { credentials: "include" });
      const data = await res.json();
      setToken(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchToken(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/auth/support-token", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setToken(data);
      toast({ title: "Support code generated", description: "Share this code with support." });
    } catch {
      toast({ title: "Error", description: "Failed to generate support code.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async () => {
    setRevoking(true);
    try {
      await fetch("/api/auth/support-token/revoke", {
        method: "POST",
        credentials: "include",
      });
      setToken(null);
      toast({ title: "Support code revoked", description: "Access has been removed." });
    } catch {
      toast({ title: "Error", description: "Failed to revoke support code.", variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  };

  const copyCode = () => {
    if (token?.token) {
      navigator.clipboard.writeText(token.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6 flex justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div>
        <h3 className="font-medium text-slate-200 flex items-center gap-2">
          <Headphones className="w-4 h-4 text-amber-400" />
          Request Support
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Generate a temporary code to share with support. This grants them limited access to help with your account for 1 hour.
        </p>
      </div>

      {token ? (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
            <div className="text-xs text-slate-500 mb-2">Your Support Code</div>
            <div className="text-3xl font-mono font-bold text-amber-400 tracking-[0.4em] mb-3">
              {token.token}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyCode}
              className="border-slate-600 text-slate-300"
            >
              {copied ? (
                <><CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Copied</>
              ) : (
                <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Code</>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              Expires: {new Date(token.expires_at).toLocaleTimeString()}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${token.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
              {token.status}
            </span>
          </div>

          <Button
            variant="outline"
            onClick={revoke}
            disabled={revoking}
            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            {revoking ? "Revoking..." : "Cancel Support Request"}
          </Button>
        </div>
      ) : (
        <Button
          onClick={generate}
          disabled={generating}
          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium"
        >
          {generating ? (
            <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin mr-2" />
          ) : (
            <Headphones className="w-4 h-4 mr-2" />
          )}
          Generate Support Code
        </Button>
      )}

      <p className="text-xs text-slate-500">
        Your support code is valid for 1 hour. You can revoke it at any time. Support staff can only view your account information — they cannot access your password or private messages.
      </p>
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords do not match", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      toast({ title: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="font-medium text-slate-200 mb-2">Change Password</h3>

      <div className="space-y-2">
        <Label className="text-slate-300">Current Password</Label>
        <div className="relative">
          <Input
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-100 pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">New Password</Label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-100 pr-10"
            placeholder="At least 8 characters"
            required
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Confirm New Password</Label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="bg-slate-800 border-slate-700 text-slate-100"
          required
        />
      </div>

      <Button
        type="submit"
        className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
      >
        {loading ? "Changing..." : "Change Password"}
      </Button>
    </form>
  );
}

const GOOGLE_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const VISIBILITY_LABELS = {
  private: 'Private (Only you)',
  galaxy: 'Galaxy (Your household)',
  universe: 'Everyone (All connected family)',
};

function GoogleCalendarSettings() {
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const { data: googleStatus } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: async () => {
      const res = await fetch('/api/calendar/google/status', { credentials: 'include' });
      if (!res.ok) return { connected: false };
      return res.json();
    },
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ['googleCalendars'],
    queryFn: async () => {
      const res = await fetch('/api/calendar/google/calendars', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!googleStatus?.connected,
  });

  const { data: prefs = {} } = useQuery({
    queryKey: ['googlePreferences'],
    queryFn: async () => {
      const res = await fetch('/api/calendar/google/preferences', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!googleStatus?.connected,
  });

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/calendar/google/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      queryClient.invalidateQueries(['googleStatus']);
      queryClient.invalidateQueries(['googleCalendars']);
      queryClient.invalidateQueries(['googlePreferences']);
      queryClient.invalidateQueries(['googleEvents']);
      toast({ title: 'Google Calendar disconnected' });
    } catch (err) {
      toast({ title: 'Failed to disconnect Google Calendar', variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const updatePreference = async (key, value, nameKey, nameValue) => {
    setSavingPrefs(true);
    try {
      const body = { [key]: value };
      if (nameKey) body[nameKey] = nameValue;
      const res = await fetch('/api/calendar/google/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      queryClient.invalidateQueries(['googlePreferences']);
      queryClient.invalidateQueries(['googleStatus']);
      toast({ title: 'Preference saved' });
    } catch (err) {
      toast({ title: 'Failed to save preference', variant: "destructive" });
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        {GOOGLE_ICON}
        <div>
          <h3 className="font-medium text-slate-200">Google Calendar</h3>
          <p className="text-xs text-slate-400">Sync events between StarThread and Google Calendar</p>
        </div>
      </div>

      {googleStatus?.connected ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/5 border border-green-500/20">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-sm font-medium text-slate-200">Connected</p>
                <p className="text-xs text-slate-400">
                  {googleStatus.calendarName
                    ? `Syncing from: ${googleStatus.calendarName}`
                    : 'Google Calendar integration is active'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="border-red-800 text-red-400 hover:bg-red-900/20 hover:border-red-700"
            >
              {disconnecting ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
              Disconnect
            </Button>
          </div>

          {calendars.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs uppercase tracking-wider">Sync From (read events)</Label>
                <Select
                  value={prefs.sync_from || 'primary'}
                  onValueChange={(val) => {
                    const cal = calendars.find(c => c.id === val);
                    updatePreference('sync_from', val, 'sync_from_name', cal?.summary || 'Primary');
                  }}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {calendars.map(cal => (
                      <SelectItem key={cal.id} value={cal.id} className="text-slate-200">
                        {cal.summary}{cal.primary ? ' (Primary)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-xs uppercase tracking-wider">Sync To (push events)</Label>
                <Select
                  value={prefs.sync_to || 'primary'}
                  onValueChange={(val) => {
                    const cal = calendars.find(c => c.id === val);
                    updatePreference('sync_to', val, 'sync_to_name', cal?.summary || 'Primary');
                  }}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {calendars.map(cal => (
                      <SelectItem key={cal.id} value={cal.id} className="text-slate-200">
                        {cal.summary}{cal.primary ? ' (Primary)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-xs uppercase tracking-wider">Default Visibility for Imported Events</Label>
                <Select
                  value={prefs.default_import_visibility || 'galaxy'}
                  onValueChange={(val) => updatePreference('default_import_visibility', val)}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {Object.entries(VISIBILITY_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="text-slate-200">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300 mb-1">Google Calendar is not connected</p>
              <p className="text-xs text-slate-500">
                Connect Google Calendar through the Replit Integrations panel, or reconnect if you previously disconnected.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch('/api/calendar/google/reconnect', {
                    method: 'POST',
                    credentials: 'include',
                  });
                  if (res.ok) {
                    queryClient.invalidateQueries(['googleStatus']);
                    queryClient.invalidateQueries(['googleCalendars']);
                    queryClient.invalidateQueries(['googlePreferences']);
                    toast({ title: 'Google Calendar reconnected' });
                  } else {
                    const data = await res.json();
                    toast({ title: data.error || 'Could not reconnect', variant: "destructive" });
                  }
                } catch {
                  toast({ title: 'Failed to reconnect', variant: "destructive" });
                }
              }}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 flex-shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeEmailForm() {
  const { user, checkAppState } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_email: newEmail, password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change email');
      }

      toast({ title: "Email changed successfully" });
      setNewEmail("");
      setPassword("");
      if (checkAppState) checkAppState();
    } catch (error) {
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="font-medium text-slate-200 mb-2">Change Email</h3>
      <p className="text-sm text-slate-400">
        Current email: <span className="text-slate-300">{user?.email}</span>
      </p>

      <div className="space-y-2">
        <Label className="text-slate-300">New Email</Label>
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="new@email.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Current Password</Label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-100 pr-10"
            placeholder="Verify your identity"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
        disabled={loading || !newEmail || !password}
      >
        {loading ? "Updating..." : "Update Email"}
      </Button>
    </form>
  );
}

function DownloadDataCard() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch('/api/my-data/export', { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `starthread-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Data downloaded successfully' });
    } catch (err) {
      toast({ title: 'Failed to download data', variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <h3 className="font-medium text-slate-200 mb-2">Download Your Data</h3>
      <p className="text-sm text-slate-400 mb-4">
        Download a copy of all your personal data stored in StarThread.
      </p>
      <Button
        variant="outline"
        onClick={handleDownload}
        disabled={downloading}
        className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500"
      >
        <Download className="w-4 h-4 mr-2" />
        {downloading ? 'Preparing...' : 'Download My Data'}
      </Button>
    </div>
  );
}

function DeleteAccountCard() {
  const { logout } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      const response = await fetch('/api/auth/account', {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        toast({ title: data.error || 'Failed to delete account', variant: "destructive" });
        setDeleting(false);
        return;
      }
      toast({ title: 'Account deleted' });
      logout();
    } catch (err) {
      toast({ title: 'Failed to delete account', variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 border border-red-900/30">
      <h3 className="font-medium text-red-400 mb-2">Delete Account</h3>
      {!showConfirm ? (
        <>
          <p className="text-sm text-slate-400 mb-4">
            Permanently delete your account. Your star will remain in your family's universe, but your login and personal data will be removed. This cannot be undone.
          </p>
          <Button
            variant="outline"
            onClick={() => setShowConfirm(true)}
            className="border-red-800 text-red-400 hover:bg-red-950 hover:border-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete My Account
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-950/50 border border-red-900/50">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">
              <p className="font-medium mb-1">This action is permanent</p>
              <p className="text-red-400/80">Your login credentials will be deleted and you will no longer be able to sign in. Your star profile will remain in your family's universe but will no longer be linked to an account.</p>
            </div>
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Type DELETE to confirm</Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="bg-slate-800 border-slate-700 text-slate-100 mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              {deleting ? 'Deleting...' : 'Permanently Delete'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowConfirm(false); setConfirmText(''); }}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BetaProgramSection() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: betaData, isLoading } = useQuery({
    queryKey: ["beta-status"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/beta-status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch beta status");
      return res.json();
    },
  });

  const handleJoinBeta = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription/join-beta", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Welcome to the beta!", description: "You now have full access to all features." });
      queryClient.invalidateQueries({ queryKey: ["beta-status"] });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveBeta = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription/leave-beta", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Beta left", description: "You have left the beta program." });
      queryClient.invalidateQueries({ queryKey: ["beta-status"] });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const phase = betaData?.beta?.phase;
  const isParticipant = betaData?.isParticipant;

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6 border border-cyan-500/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-lg">StarThread Beta Program</h3>
            <p className="text-sm text-slate-400">
              {phase === "active" ? `${betaData.beta.daysRemaining} days remaining` :
               phase === "grace" ? `Grace period: ${betaData.beta.daysRemaining} days left` :
               "The beta program has ended"}
            </p>
          </div>
          {isParticipant && (
            <span className="ml-auto px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-medium border border-cyan-500/30">
              Active
            </span>
          )}
        </div>

        {phase === "active" && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
              <h4 className="text-slate-200 font-medium">What you get</h4>
              <ul className="text-sm text-slate-400 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  Full access to all premium features during beta
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  30-day grace period after beta ends
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {betaData?.discountPercent}% discount on your first {betaData?.discountDurationMonths} months of subscription
                </li>
              </ul>
            </div>

            {isParticipant ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Joined {betaData?.joinedAt ? new Date(betaData.joinedAt).toLocaleDateString() : ""}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLeaveBeta}
                  disabled={loading}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Leave Beta
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleJoinBeta}
                disabled={loading}
                className="bg-cyan-600 hover:bg-cyan-700 text-white w-full"
              >
                <Rocket className="w-4 h-4 mr-2" />
                Join the Beta
              </Button>
            )}
          </div>
        )}

        {phase === "grace" && isParticipant && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-sm text-amber-200">
              The beta has ended. You still have full access for {betaData.beta.daysRemaining} more days. 
              Subscribe to keep your premium features and enjoy your {betaData?.discountPercent}% beta discount.
            </p>
          </div>
        )}

        {phase === "ended" && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-sm text-slate-400">
              The beta program has concluded. Thank you for participating! 
              {isParticipant && !betaData?.discountApplied && (
                <span className="text-cyan-300"> Your {betaData?.discountPercent}% discount is available when you subscribe.</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyLink({ title, description, href }) {
  return (
    <Link to={href} className="flex items-start justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors group">
      <div>
        <h4 className="text-slate-200 font-medium group-hover:text-amber-300 transition-colors">{title}</h4>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>
      <ExternalLink className="w-4 h-4 text-slate-500 mt-1 flex-shrink-0 ml-4 group-hover:text-amber-400 transition-colors" />
    </Link>
  );
}

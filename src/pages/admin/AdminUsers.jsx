import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Crown,
  Trash2,
  X,
  Key,
  UserCog,
} from "lucide-react";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const LIMIT = 25;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const loadUserDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { credentials: "include" });
      const data = await res.json();
      setSelectedUser(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdate = async (userId, field, value) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setEditField(null);
        fetchUsers();
        if (selectedUser) loadUserDetail(userId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPassword = async (userId) => {
    if (!resetPassword || resetPassword.length < 6) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ new_password: resetPassword }),
      });
      if (res.ok) {
        setResetPassword("");
        setEditField(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (userId) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setConfirmDelete(null);
        setSelectedUser(null);
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <span className="text-xs text-slate-500">{total} total</span>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">User</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Role</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Tier</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Household</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Joined</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No users found</td></tr>
              ) : users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => loadUserDetail(u.id)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="text-slate-200 font-medium">{u.full_name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded text-xs font-medium">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">User</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-slate-400 capitalize">{u.subscription_tier || "free"}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">{u.household_name || "-"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-600">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <UserCog className="w-4 h-4 text-slate-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {(selectedUser || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="p-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedUser && (
              <div className="p-5 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">{selectedUser.full_name}</h3>
                    <p className="text-sm text-slate-500">{selectedUser.email}</p>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-slate-500 hover:text-slate-300">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Role</div>
                    {editField === "role" ? (
                      <div className="flex gap-1">
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 flex-1"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button onClick={() => handleUpdate(selectedUser.id, "role", editValue)} className="text-xs text-blue-400 px-2">Save</button>
                        <button onClick={() => setEditField(null)} className="text-xs text-slate-500 px-1">×</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditField("role"); setEditValue(selectedUser.role); }} className="text-slate-200 hover:text-blue-400 capitalize">{selectedUser.role}</button>
                    )}
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Subscription</div>
                    {editField === "subscription_tier" ? (
                      <div className="flex gap-1">
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 flex-1"
                        >
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                          <option value="family">Family</option>
                        </select>
                        <button onClick={() => handleUpdate(selectedUser.id, "subscription_tier", editValue)} className="text-xs text-blue-400 px-2">Save</button>
                        <button onClick={() => setEditField(null)} className="text-xs text-slate-500 px-1">×</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditField("subscription_tier"); setEditValue(selectedUser.subscription_tier || "free"); }} className="text-slate-200 hover:text-blue-400 capitalize">{selectedUser.subscription_tier || "free"}</button>
                    )}
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Person</div>
                    <div className="text-slate-200">{selectedUser.name || "-"}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Joined</div>
                    <div className="text-slate-200">{new Date(selectedUser.created_at).toLocaleDateString()}</div>
                  </div>
                  {selectedUser.birth_date && (
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">Birthday</div>
                      <div className="text-slate-200">{new Date(selectedUser.birth_date).toLocaleDateString()}</div>
                    </div>
                  )}
                  {selectedUser.role_type && (
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">Age Group</div>
                      <div className="text-slate-200 capitalize">{selectedUser.role_type}</div>
                    </div>
                  )}
                  {selectedUser.household && (
                    <div className="bg-slate-800/50 rounded-lg p-3 col-span-2">
                      <div className="text-xs text-slate-500 mb-1">Household</div>
                      <div className="text-slate-200">{selectedUser.household.name}</div>
                    </div>
                  )}
                </div>

                {selectedUser.relationships?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Relationships</h4>
                    <div className="space-y-1.5">
                      {selectedUser.relationships.map((r) => (
                        <div key={r.id} className="flex items-center justify-between bg-slate-800/30 rounded px-3 py-2 text-sm">
                          <span className="text-slate-300">{r.related_name}</span>
                          <span className="text-xs text-slate-500 capitalize">{r.relationship_type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 space-y-3">
                  {editField === "password" ? (
                    <div className="flex gap-2 items-center">
                      <Key className="w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        placeholder="New password (min 6 chars)"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
                      />
                      <button
                        onClick={() => handleResetPassword(selectedUser.id)}
                        disabled={resetPassword.length < 6}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-30 px-2"
                      >
                        Reset
                      </button>
                      <button onClick={() => { setEditField(null); setResetPassword(""); }} className="text-xs text-slate-500">×</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditField("password")} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
                      <Key className="w-4 h-4" /> Reset Password
                    </button>
                  )}

                  {confirmDelete === selectedUser.id ? (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <span className="text-sm text-red-400 flex-1">Permanently delete this user?</span>
                      <button onClick={() => handleDelete(selectedUser.id)} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500">Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-slate-400">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(selectedUser.id)} className="flex items-center gap-2 text-sm text-red-400/70 hover:text-red-400">
                      <Trash2 className="w-4 h-4" /> Delete Account
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

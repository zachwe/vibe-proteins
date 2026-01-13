/**
 * Admin Page
 *
 * Admin-only page for user management and impersonation.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useSession, admin } from "../lib/auth";
import Spinner from "../components/Spinner";
import NotFound from "./NotFound";

interface User {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: string | null;
  banned: boolean | null;
  balanceFormatted: string;
  createdAt: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  limit: number;
  offset: number;
}

class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

async function fetchUsers(search: string): Promise<UsersResponse> {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", "100");

  const response = await fetch(`${apiUrl}/api/admin/users?${params}`, {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new ForbiddenError();
    }
    throw new Error("Failed to fetch users");
  }

  return response.json();
}

export default function Admin() {
  const navigate = useNavigate();
  const { data: session, isPending: sessionLoading } = useSession();
  const [search, setSearch] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => fetchUsers(search),
    enabled: !!session?.user,
  });

  // Check if current session is an impersonation session
  const isImpersonating = !!(session?.session as any)?.impersonatedBy;

  const handleImpersonate = async (userId: string) => {
    setImpersonating(userId);
    setError(null);

    try {
      const result = await admin.impersonateUser({ userId });
      if (result.error) {
        setError(result.error.message || "Failed to impersonate user");
        setImpersonating(null);
        return;
      }
      // Redirect to home after successful impersonation
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to impersonate user");
      setImpersonating(null);
    }
  };

  const handleStopImpersonating = async () => {
    setError(null);
    try {
      const result = await admin.stopImpersonating();
      if (result.error) {
        setError(result.error.message || "Failed to stop impersonation");
        return;
      }
      // Refresh the page to get back to admin session
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop impersonation");
    }
  };

  // Loading state
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not logged in - show 404 to hide admin page existence
  if (!session?.user) {
    return <NotFound />;
  }

  // Not authorized (403) - show 404 to hide admin page existence
  if (fetchError instanceof ForbiddenError) {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Helmet>
        <title>Admin | ProteinDojo</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-slate-400">Manage users and impersonation sessions</p>
        </div>

        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-amber-500/20 border border-amber-500 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <p className="text-amber-200 font-medium">
                    You are currently impersonating: {session.user.email}
                  </p>
                  <p className="text-amber-300/70 text-sm">
                    All actions will be performed as this user
                  </p>
                </div>
              </div>
              <button
                onClick={handleStopImpersonating}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Stop Impersonating
              </button>
            </div>
          </div>
        )}

        {/* Error message - ForbiddenError is handled above with NotFound */}
        {(error || (fetchError && !(fetchError instanceof ForbiddenError))) && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4 mb-6">
            {error || (fetchError as Error)?.message || "An error occurred"}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search by email, name, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 text-white px-4 py-3 pl-10 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Users table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : data?.users ? (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      User
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Email
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Role
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Balance
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Joined
                    </th>
                    <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {data.users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-white font-medium">
                            {user.name || "—"}
                          </div>
                          {user.username && (
                            <div className="text-slate-400 text-sm">
                              @{user.username}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{user.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-slate-600/50 text-slate-300"
                          }`}
                        >
                          {user.role || "user"}
                        </span>
                        {user.banned && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300">
                            banned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-sm">
                        {user.balanceFormatted}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {user.id !== session.user.id && user.role !== "admin" && (
                          <button
                            onClick={() => handleImpersonate(user.id)}
                            disabled={impersonating === user.id || isImpersonating}
                            className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-1.5 px-3 rounded transition-colors"
                          >
                            {impersonating === user.id ? (
                              <span className="flex items-center gap-1">
                                <Spinner size="sm" color="white" />
                                ...
                              </span>
                            ) : (
                              "Impersonate"
                            )}
                          </button>
                        )}
                        {user.role === "admin" && (
                          <span className="text-slate-500 text-sm">Admin</span>
                        )}
                        {user.id === session.user.id && (
                          <span className="text-slate-500 text-sm">You</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total count */}
            <div className="px-4 py-3 bg-slate-700/30 text-sm text-slate-400">
              Showing {data.users.length} of {data.total} users
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

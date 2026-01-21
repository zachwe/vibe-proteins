/**
 * Teams Page
 *
 * Manage teams: create new teams, view team details, invite members.
 */

import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Link } from "react-router-dom";
import {
  useSession,
  useListOrganizations,
  createOrganization,
  inviteMember,
  removeMember,
  updateMemberRole,
  leaveOrganization,
  deleteOrganization,
  setActiveOrganization,
  listInvitations,
  cancelInvitation,
} from "../lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/hooks";

interface TeamMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface TeamDetails {
  id: string;
  name: string;
  slug: string;
  members: TeamMember[];
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
}

export default function Teams() {
  const { data: session, isPending: sessionPending } = useSession();
  const { data: orgsData, isLoading: orgsLoading, refetch: refetchOrgs } = useListOrganizations();
  const organizations = orgsData ?? [];
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [teamDetails, setTeamDetails] = useState<TeamDetails | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  if (!sessionPending && !session?.user) {
    return <Navigate to="/login?redirect=/teams" replace />;
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreateLoading(true);
    setCreateError(null);

    try {
      const slug = newTeamName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const result = await createOrganization({
        name: newTeamName.trim(),
        slug,
      });

      if (result.error) {
        setCreateError(result.error.message || "Failed to create team");
        setCreateLoading(false);
        return;
      }

      // Refresh teams list
      await refetchOrgs();
      queryClient.invalidateQueries({ queryKey: queryKeys.user });

      setNewTeamName("");
      setShowCreateForm(false);
    } catch (err) {
      console.error("Failed to create team:", err);
      setCreateError("Failed to create team");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExpandTeam = async (teamId: string) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
      setTeamDetails(null);
      setPendingInvitations([]);
      return;
    }

    setExpandedTeam(teamId);
    setDetailsLoading(true);
    setInviteError(null);
    setInviteSuccess(false);
    setPendingInvitations([]);

    try {
      // Get full organization details with members
      // Use direct fetch with query param instead of BetterAuth client (more robust)
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(
        `${apiUrl}/api/auth/organization/get-full-organization?organizationId=${teamId}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();

      if (data) {
        setTeamDetails({
          id: data.id,
          name: data.name,
          slug: data.slug,
          members: data.members as TeamMember[],
        });
      }

      // Also fetch pending invitations
      const invitationsResult = await listInvitations({ organizationId: teamId });
      if (invitationsResult.data) {
        // Filter to only show pending invitations
        const pending = invitationsResult.data.filter(
          (inv: PendingInvitation) => inv.status === "pending"
        );
        setPendingInvitations(pending);
      }
    } catch (err) {
      console.error("Failed to load team details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !expandedTeam) return;

    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(false);

    try {
      const result = await inviteMember({
        organizationId: expandedTeam,
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      if (result.error) {
        setInviteError(result.error.message || "Failed to send invitation");
        setInviteLoading(false);
        return;
      }

      setInviteEmail("");
      setInviteSuccess(true);
      // Refresh invitations list
      const invitationsResult = await listInvitations({ organizationId: expandedTeam });
      if (invitationsResult.data) {
        const pending = invitationsResult.data.filter(
          (inv: PendingInvitation) => inv.status === "pending"
        );
        setPendingInvitations(pending);
      }
    } catch (err) {
      console.error("Failed to invite member:", err);
      setInviteError("Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!expandedTeam) return;
    setActionLoading(invitationId);
    setActionError(null);

    try {
      const result = await cancelInvitation({ invitationId });

      if (result.error) {
        setActionError(result.error.message || "Failed to cancel invitation");
        setActionLoading(null);
        return;
      }

      // Refresh invitations list
      const invitationsResult = await listInvitations({ organizationId: expandedTeam });
      if (invitationsResult.data) {
        const pending = invitationsResult.data.filter(
          (inv: PendingInvitation) => inv.status === "pending"
        );
        setPendingInvitations(pending);
      }
    } catch (err) {
      console.error("Failed to cancel invitation:", err);
      setActionError("Failed to cancel invitation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!expandedTeam) return;
    setActionLoading(memberId);
    setActionError(null);

    try {
      const result = await removeMember({
        organizationId: expandedTeam,
        memberIdOrEmail: memberId,
      });

      if (result.error) {
        setActionError(result.error.message || "Failed to remove member");
        setActionLoading(null);
        return;
      }

      // Refresh team details
      await handleExpandTeam(expandedTeam);
    } catch (err) {
      console.error("Failed to remove member:", err);
      setActionError("Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: "admin" | "member" | "owner") => {
    if (!expandedTeam) return;
    setActionLoading(memberId);
    setActionError(null);

    try {
      const result = await updateMemberRole({
        organizationId: expandedTeam,
        memberId,
        role: newRole,
      });

      if (result.error) {
        setActionError(result.error.message || "Failed to update role");
        setActionLoading(null);
        return;
      }

      // Refresh team details
      await handleExpandTeam(expandedTeam);
    } catch (err) {
      console.error("Failed to update role:", err);
      setActionError("Failed to update role");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!window.confirm("Are you sure you want to leave this team?")) return;

    setActionLoading(teamId);
    setActionError(null);

    try {
      const result = await leaveOrganization({ organizationId: teamId });

      if (result.error) {
        setActionError(result.error.message || "Failed to leave team");
        setActionLoading(null);
        return;
      }

      // Clear active org (in case the left team was active) and refresh
      await setActiveOrganization({ organizationId: null });
      await refetchOrgs();
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      setExpandedTeam(null);
      setTeamDetails(null);
    } catch (err) {
      console.error("Failed to leave team:", err);
      setActionError("Failed to leave team");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${teamName}"? This cannot be undone.`)) return;

    setActionLoading(teamId);
    setActionError(null);

    try {
      const result = await deleteOrganization({ organizationId: teamId });

      if (result.error) {
        setActionError(result.error.message || "Failed to delete team");
        setActionLoading(null);
        return;
      }

      // Clear active org (in case the deleted team was active) and refresh
      await setActiveOrganization({ organizationId: null });
      await refetchOrgs();
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      setExpandedTeam(null);
      setTeamDetails(null);
    } catch (err) {
      console.error("Failed to delete team:", err);
      setActionError("Failed to delete team");
    } finally {
      setActionLoading(null);
    }
  };

  const currentUserId = session?.user?.id;

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Teams | ProteinDojo</title>
        <meta name="description" content="Manage your teams on ProteinDojo." />
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-white">Teams</h1>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {showCreateForm ? "Cancel" : "Create Team"}
            </button>
          </div>

          {/* Create team form */}
          {showCreateForm && (
            <div className="bg-slate-800 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">Create a New Team</h2>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                {createError && (
                  <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 text-sm">
                    {createError}
                  </div>
                )}
                <div>
                  <label htmlFor="teamName" className="block text-sm font-medium text-slate-300 mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    id="teamName"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="My Team"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={createLoading || !newTeamName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {createLoading ? "Creating..." : "Create Team"}
                </button>
              </form>
            </div>
          )}

          {/* Teams list */}
          {orgsLoading || sessionPending ? (
            <div className="text-center py-12">
              <div className="animate-pulse text-slate-400">Loading teams...</div>
            </div>
          ) : organizations.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">No Teams Yet</h2>
              <p className="text-slate-400 mb-6">
                Create a team to share billing and collaborate with others.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Create Your First Team
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {actionError && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 text-sm">
                  {actionError}
                </div>
              )}
              {organizations.map((org) => (
                <div key={org.id} className="bg-slate-800 rounded-xl overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-750 transition-colors"
                    onClick={() => handleExpandTeam(org.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-blue-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{org.name}</h3>
                          <p className="text-sm text-slate-400">/{org.slug}</p>
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${expandedTeam === org.id ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded team details */}
                  {expandedTeam === org.id && (
                    <div className="border-t border-slate-700 p-4">
                      {detailsLoading ? (
                        <div className="text-center py-4">
                          <div className="animate-pulse text-slate-400">Loading...</div>
                        </div>
                      ) : teamDetails ? (
                        <div className="space-y-6">
                          {/* Members list */}
                          <div>
                            <h4 className="text-sm font-medium text-slate-300 mb-3">Members</h4>
                            <div className="space-y-2">
                              {teamDetails.members.map((member) => {
                                const isCurrentUser = member.userId === currentUserId;
                                const isOwner = member.role === "owner";
                                const currentUserRole = teamDetails.members.find(
                                  (m) => m.userId === currentUserId
                                )?.role;
                                const canManage =
                                  currentUserRole === "owner" ||
                                  (currentUserRole === "admin" && member.role === "member");

                                return (
                                  <div
                                    key={member.id}
                                    className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                        {(member.user.name || member.user.email)?.[0]?.toUpperCase() || "?"}
                                      </div>
                                      <div>
                                        <div className="text-white text-sm">
                                          {member.user.name || member.user.email}
                                          {isCurrentUser && (
                                            <span className="text-slate-400 text-xs ml-2">(you)</span>
                                          )}
                                        </div>
                                        <div className="text-slate-400 text-xs">{member.user.email}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {canManage && !isOwner ? (
                                        <select
                                          value={member.role}
                                          onChange={(e) =>
                                            handleChangeRole(
                                              member.id,
                                              e.target.value as "admin" | "member"
                                            )
                                          }
                                          disabled={actionLoading === member.id}
                                          className="bg-slate-600 text-white text-xs rounded px-2 py-1 border-none focus:ring-2 focus:ring-blue-500"
                                        >
                                          <option value="member">Member</option>
                                          <option value="admin">Admin</option>
                                        </select>
                                      ) : (
                                        <span
                                          className={`text-xs px-2 py-1 rounded ${
                                            isOwner
                                              ? "bg-yellow-500/20 text-yellow-400"
                                              : member.role === "admin"
                                                ? "bg-blue-500/20 text-blue-400"
                                                : "bg-slate-600 text-slate-300"
                                          }`}
                                        >
                                          {member.role}
                                        </span>
                                      )}
                                      {canManage && !isCurrentUser && !isOwner && (
                                        <button
                                          onClick={() => handleRemoveMember(member.id)}
                                          disabled={actionLoading === member.id}
                                          className="text-red-400 hover:text-red-300 p-1"
                                          title="Remove member"
                                        >
                                          <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={1.5}
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M6 18 18 6M6 6l12 12"
                                            />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Pending invitations */}
                          {pendingInvitations.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-slate-300 mb-3">
                                Pending Invitations ({pendingInvitations.length})
                              </h4>
                              <div className="space-y-2">
                                {pendingInvitations.map((invitation) => {
                                  const isExpired = new Date(invitation.expiresAt) < new Date();
                                  const currentUserRole = teamDetails.members.find(
                                    (m) => m.userId === currentUserId
                                  )?.role;
                                  const canCancel = currentUserRole === "owner" || currentUserRole === "admin";

                                  return (
                                    <div
                                      key={invitation.id}
                                      className="flex items-center justify-between bg-slate-700/30 border border-slate-600/50 border-dashed rounded-lg p-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-600/50 rounded-full flex items-center justify-center text-slate-400 text-sm">
                                          <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={1.5}
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                                            />
                                          </svg>
                                        </div>
                                        <div>
                                          <div className="text-slate-300 text-sm">{invitation.email}</div>
                                          <div className="text-slate-500 text-xs">
                                            {isExpired ? (
                                              <span className="text-red-400">Expired</span>
                                            ) : (
                                              <>Invited as {invitation.role}</>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                                          pending
                                        </span>
                                        {canCancel && (
                                          <button
                                            onClick={() => handleCancelInvitation(invitation.id)}
                                            disabled={actionLoading === invitation.id}
                                            className="text-red-400 hover:text-red-300 p-1"
                                            title="Cancel invitation"
                                          >
                                            <svg
                                              className="w-4 h-4"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              strokeWidth={1.5}
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M6 18 18 6M6 6l12 12"
                                              />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Invite form */}
                          {teamDetails.members.some(
                            (m) => m.userId === currentUserId && (m.role === "owner" || m.role === "admin")
                          ) && (
                            <div>
                              <h4 className="text-sm font-medium text-slate-300 mb-3">Invite Member</h4>
                              <form onSubmit={handleInvite} className="space-y-3">
                                {inviteError && (
                                  <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-2 text-sm">
                                    {inviteError}
                                  </div>
                                )}
                                {inviteSuccess && (
                                  <div className="bg-green-500/10 border border-green-500 text-green-400 rounded-lg p-2 text-sm">
                                    Invitation sent successfully!
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                  />
                                  <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                  <button
                                    type="submit"
                                    disabled={inviteLoading || !inviteEmail.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                                  >
                                    {inviteLoading ? "..." : "Invite"}
                                  </button>
                                </div>
                              </form>
                            </div>
                          )}

                          {/* Team actions */}
                          <div className="flex gap-3 pt-4 border-t border-slate-700">
                            <Link
                              to="/billing"
                              className="text-sm text-blue-400 hover:text-blue-300"
                            >
                              Add Funds
                            </Link>
                            {teamDetails.members.some(
                              (m) => m.userId === currentUserId && m.role !== "owner"
                            ) && (
                              <button
                                onClick={() => handleLeaveTeam(org.id)}
                                disabled={actionLoading === org.id}
                                className="text-sm text-red-400 hover:text-red-300"
                              >
                                Leave Team
                              </button>
                            )}
                            {teamDetails.members.some(
                              (m) => m.userId === currentUserId && m.role === "owner"
                            ) && (
                              <button
                                onClick={() => handleDeleteTeam(org.id, org.name)}
                                disabled={actionLoading === org.id}
                                className="text-sm text-red-400 hover:text-red-300"
                              >
                                Delete Team
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

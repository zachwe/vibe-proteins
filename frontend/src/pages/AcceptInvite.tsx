/**
 * AcceptInvite Page
 *
 * Allows users to accept or reject team invitations.
 * Handles both logged-in and logged-out users.
 */

import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  useSession,
  acceptInvitation,
  rejectInvitation,
  authClient,
} from "../lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/hooks";

interface InvitationInfo {
  id: string;
  organizationName: string;
  organizationSlug: string;
  inviterEmail: string;
  role: string;
  status: string;
  expiresAt: Date;
}

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationId = searchParams.get("id");
  const queryClient = useQueryClient();

  const { data: session, isPending: sessionPending } = useSession();
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionComplete, setActionComplete] = useState<"accepted" | "rejected" | null>(null);

  // Fetch invitation details
  useEffect(() => {
    async function fetchInvitation() {
      if (!invitationId) {
        setError("No invitation ID provided");
        setLoading(false);
        return;
      }

      try {
        // Use BetterAuth's getInvitation endpoint
        const result = await authClient.organization.getInvitation({
          query: { id: invitationId },
        });

        if (result.error) {
          setError(result.error.message || "Failed to load invitation");
          setLoading(false);
          return;
        }

        if (!result.data) {
          setError("Invitation not found or has expired");
          setLoading(false);
          return;
        }

        setInvitation({
          id: result.data.id,
          organizationName: result.data.organizationName,
          organizationSlug: result.data.organizationSlug,
          inviterEmail: result.data.inviterEmail,
          role: result.data.role,
          status: result.data.status,
          expiresAt: new Date(result.data.expiresAt),
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch invitation:", err);
        setError("Failed to load invitation details");
        setLoading(false);
      }
    }

    fetchInvitation();
  }, [invitationId]);

  const handleAccept = async () => {
    if (!invitationId) return;
    setActionLoading(true);
    setError(null);

    try {
      const result = await acceptInvitation({ invitationId });

      if (result.error) {
        setError(result.error.message || "Failed to accept invitation");
        setActionLoading(false);
        return;
      }

      setActionComplete("accepted");
      // Invalidate queries to refresh team list
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    } catch (err) {
      console.error("Failed to accept invitation:", err);
      setError("Failed to accept invitation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!invitationId) return;
    setActionLoading(true);
    setError(null);

    try {
      const result = await rejectInvitation({ invitationId });

      if (result.error) {
        setError(result.error.message || "Failed to reject invitation");
        setActionLoading(false);
        return;
      }

      setActionComplete("rejected");
    } catch (err) {
      console.error("Failed to reject invitation:", err);
      setError("Failed to reject invitation");
    } finally {
      setActionLoading(false);
    }
  };

  // Loading state
  if (loading || sessionPending) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Helmet>
          <title>Team Invitation | ProteinDojo</title>
        </Helmet>
        <div className="animate-pulse text-slate-400">Loading invitation...</div>
      </div>
    );
  }

  // Error state (no invitation)
  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Helmet>
          <title>Invitation Error | ProteinDojo</title>
        </Helmet>
        <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Invitation</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // Not logged in - redirect to login with return URL
  if (!session?.user) {
    const returnUrl = `/accept-invite?id=${invitationId}`;
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Helmet>
          <title>Sign In Required | ProteinDojo</title>
        </Helmet>
        <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-blue-500"
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
          <h1 className="text-xl font-bold text-white mb-2">Team Invitation</h1>
          {invitation && (
            <p className="text-slate-400 mb-6">
              You've been invited to join <strong className="text-white">{invitation.organizationName}</strong>.
              <br />
              Sign in or create an account to accept.
            </p>
          )}
          <div className="space-y-3">
            <Link
              to={`/login?redirect=${encodeURIComponent(returnUrl)}`}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              to={`/signup?redirect=${encodeURIComponent(returnUrl)}`}
              className="block w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Action complete - show success/rejection message
  if (actionComplete) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Helmet>
          <title>Invitation {actionComplete === "accepted" ? "Accepted" : "Declined"} | ProteinDojo</title>
        </Helmet>
        <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md text-center">
          <div
            className={`w-16 h-16 ${actionComplete === "accepted" ? "bg-green-500/20" : "bg-slate-500/20"} rounded-full flex items-center justify-center mx-auto mb-4`}
          >
            {actionComplete === "accepted" ? (
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            ) : (
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
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            )}
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            {actionComplete === "accepted"
              ? `Welcome to ${invitation?.organizationName}!`
              : "Invitation Declined"}
          </h1>
          <p className="text-slate-400 mb-6">
            {actionComplete === "accepted"
              ? "You are now a member of this team. You can switch between your personal account and team context using the selector in the header."
              : "You have declined this invitation."}
          </p>
          <button
            onClick={() => navigate(actionComplete === "accepted" ? "/teams" : "/challenges")}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            {actionComplete === "accepted" ? "Go to Teams" : "Continue"}
          </button>
        </div>
      </div>
    );
  }

  // Show invitation details with accept/reject buttons
  const isExpired = invitation && invitation.expiresAt < new Date();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Helmet>
        <title>Join {invitation?.organizationName} | ProteinDojo</title>
      </Helmet>
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-blue-500"
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

        <h1 className="text-xl font-bold text-white mb-2 text-center">
          Team Invitation
        </h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {invitation && (
          <div className="space-y-4">
            <p className="text-slate-400 text-center">
              <strong className="text-slate-200">{invitation.inviterEmail}</strong> has
              invited you to join
            </p>

            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <h2 className="text-lg font-semibold text-white">
                {invitation.organizationName}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                as {invitation.role === "owner" ? "an" : "a"}{" "}
                <span className="capitalize">{invitation.role}</span>
              </p>
            </div>

            <p className="text-sm text-slate-500 text-center">
              As a team member, you'll share a billing balance and be able to
              see each other's protein designs and jobs.
            </p>

            {isExpired ? (
              <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 rounded-lg p-3 text-sm text-center">
                This invitation has expired.
              </div>
            ) : (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  disabled={actionLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {actionLoading ? "Processing..." : "Accept Invitation"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <Link
            to="/"
            className="block text-center text-slate-500 hover:text-slate-400 text-sm"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

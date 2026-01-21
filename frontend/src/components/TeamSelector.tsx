/**
 * TeamSelector Component
 *
 * Dropdown to switch between personal context and team contexts.
 * Shows current context and allows switching teams.
 */

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useListOrganizations, setActiveOrganization } from "../lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/hooks";
import type { ActiveTeam, EffectiveBalance } from "../lib/api";

interface TeamSelectorProps {
  activeTeam: ActiveTeam | null;
  effectiveBalance: EffectiveBalance;
}

export default function TeamSelector({
  activeTeam,
  effectiveBalance,
}: TeamSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Get list of user's organizations
  // Note: useListOrganizations returns { data: org[] } where data is the array directly
  const { data: organizations = [] } = useListOrganizations();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectTeam = async (organizationId: string | null) => {
    setIsOpen(false);
    await setActiveOrganization({
      organizationId,
    });
    // Invalidate queries that depend on team context
    queryClient.invalidateQueries({ queryKey: queryKeys.user });
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    queryClient.invalidateQueries({ queryKey: queryKeys.submissions });
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
  };

  const currentContext = activeTeam?.name ?? "Personal";
  const balance = effectiveBalance.balanceFormatted;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors"
      >
        {/* Team/Personal icon */}
        {activeTeam ? (
          <svg
            className="w-4 h-4 text-blue-400"
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
        ) : (
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
            />
          </svg>
        )}
        <span className="text-white text-sm font-medium max-w-[100px] truncate">
          {currentContext}
        </span>
        {/* Balance */}
        <span className="text-green-400 text-sm font-medium">{balance}</span>
        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg bg-slate-800 border border-slate-700 shadow-lg z-50">
          <div className="py-1">
            {/* Personal option */}
            <button
              onClick={() => handleSelectTeam(null)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 ${
                !activeTeam ? "text-blue-400" : "text-slate-300"
              }`}
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
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
              Personal Account
              {!activeTeam && (
                <svg
                  className="w-4 h-4 ml-auto"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </button>

            {/* Teams section */}
            {organizations.length > 0 && (
              <>
                <div className="border-t border-slate-700 my-1" />
                <div className="px-4 py-1 text-xs text-slate-500 uppercase tracking-wider">
                  Teams
                </div>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSelectTeam(org.id)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 ${
                      activeTeam?.id === org.id
                        ? "text-blue-400"
                        : "text-slate-300"
                    }`}
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
                        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                      />
                    </svg>
                    <span className="truncate">{org.name}</span>
                    {activeTeam?.id === org.id && (
                      <svg
                        className="w-4 h-4 ml-auto flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </button>
                ))}
              </>
            )}

            {/* Create team / Manage link */}
            <div className="border-t border-slate-700 my-1" />
            <Link
              to="/teams"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700"
            >
              {organizations.length > 0 ? "Manage Teams" : "Create a Team"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

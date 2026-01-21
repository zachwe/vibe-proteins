import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  plugins: [adminClient(), organizationClient()],
  fetchOptions: {
    credentials: "include", // Required for cross-origin auth cookies
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;

// Email verification
export const sendVerificationEmail = authClient.sendVerificationEmail;
export const verifyEmail = authClient.verifyEmail;

// Admin functions
export const { admin } = authClient;

// Organization (team) functions
export const { organization, useActiveOrganization, useListOrganizations } =
  authClient;

// Organization utilities for components
export const createOrganization = authClient.organization.create;
export const listOrganizations = authClient.organization.list;
export const getActiveOrganization = authClient.organization.getActiveMember;
export const setActiveOrganization = authClient.organization.setActive;
export const inviteMember = authClient.organization.inviteMember;
export const acceptInvitation = authClient.organization.acceptInvitation;
export const rejectInvitation = authClient.organization.rejectInvitation;
export const removeMember = authClient.organization.removeMember;
export const updateMemberRole = authClient.organization.updateMemberRole;
export const leaveOrganization = authClient.organization.leave;
export const deleteOrganization = authClient.organization.delete;

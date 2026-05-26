import type { UserRole } from "#/modules/users/domain/user.js";

export type PermissionSubject = {
  id: string;
  role: UserRole;
};

const supportRoles: readonly UserRole[] = ["admin", "agent"];

export function hasAnyRole(
  subject: Pick<PermissionSubject, "role">,
  roles: readonly UserRole[],
): boolean {
  return roles.includes(subject.role);
}

export function canAccessInternalComments(
  subject: Pick<PermissionSubject, "role">,
): boolean {
  return hasAnyRole(subject, supportRoles);
}

export function canAssignTickets(
  subject: Pick<PermissionSubject, "role">,
): boolean {
  return hasAnyRole(subject, supportRoles);
}

export function canChangeTicketStatus(
  subject: Pick<PermissionSubject, "role">,
): boolean {
  return hasAnyRole(subject, supportRoles);
}

export function canListUsers(
  subject: Pick<PermissionSubject, "role">,
): boolean {
  return hasAnyRole(subject, supportRoles);
}

export function canManageUserRoles(
  subject: Pick<PermissionSubject, "role">,
): boolean {
  return subject.role === "admin";
}

export function canReadAuditEvents(
  subject: Pick<PermissionSubject, "role">,
): boolean {
  return hasAnyRole(subject, supportRoles);
}

export function canReceiveTicketAssignment(
  subject: Pick<PermissionSubject, "role">,
): boolean {
  return hasAnyRole(subject, supportRoles);
}

export function canViewUser(
  subject: PermissionSubject,
  targetUserId: string,
): boolean {
  return subject.id === targetUserId || hasAnyRole(subject, supportRoles);
}

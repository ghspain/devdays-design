import type { BadgeRole } from './badgeRoles'

export const attendeeBadgeFields = [
  { id: 'name', label: 'Name', required: true, aliases: ['name', 'full_name', 'fullname', 'attendee_name'] },
  { id: 'organization', label: 'Organization', required: false, aliases: ['company', 'company_name', 'organization', 'org'] },
  { id: 'role', label: 'Role', required: false, aliases: ['role', 'position', 'title', 'job_title'] },
  { id: 'githubHandle', label: 'GitHub handle', required: false, aliases: ['github', 'github_username', 'github_handle', 'username'] },
] as const

export type AttendeeBadgeField = typeof attendeeBadgeFields[number]['id']
export type AttendeeCsvColumnMapping = Record<number, AttendeeBadgeField | 'ignore'>

/** Session-local shape produced by the CSV column mapping step. */
export interface AttendeeBadgeInput {
  name: string
  organization?: string
  role?: string
  githubHandle?: string
  badgeRole?: BadgeRole
}

import type { SupabaseClient } from '@supabase/supabase-js';

export type EndorsementRow = {
  id: string;
  created_at: string;
  developer_id: string;
  endorser_id: string | null;
  endorser_email: string | null;
  endorser_role: string | null;
  comment: string | null;
  is_anonymous: boolean | null;
  is_public: boolean | null;
  endorser_name: string | null;
  // Back-compat single skill (generated column in DB)
  skill: string | null;
  // New multi-skill support
  skills: string[] | null;
  // Nested endorser info (if FK exists)
  endorser_user?: {
    name: string | null;
    profile_pic_url: string | null;
    developers?: { public_profile_slug: string | null } | null;
  } | null;
};

export type CreateEndorsementInput = {
  developer_id: string;
  comment: string;
  endorser_name?: string | null;
  endorser_email?: string | null;
  endorser_role?: string | null;
  is_public?: boolean;
  is_anonymous?: boolean;
  skills?: string[]; // new: multi-select skills
};

export type UpdateEndorsementInput = Partial<Omit<CreateEndorsementInput, 'developer_id'>>;

/**
 * Normalizes skills the same way the DB trigger does:
 * - lowercase
 * - trim
 * - remove blanks
 * - de-duplicate (stable order)
 * - cap list to max 10
 */
export function normalizeSkills(skills: string[] | null | undefined, max = 10): string[] {
  if (!skills || skills.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const s = (raw ?? '').toLowerCase().trim();
    if (!s) continue;
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * Fetch developer’s skills from public.developers.skills (text[]).
 * Returns [] if missing.
 */
export async function getDeveloperSkills(
  supabase: SupabaseClient,
  developerUserId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('developers')
    .select('skills')
    .eq('user_id', developerUserId)
    .maybeSingle();

  if (error) {
    console.error('[endorsementUtils] getDeveloperSkills error:', error.message);
    return [];
  }
  const skills = (data?.skills as string[] | null) ?? [];
  return normalizeSkills(skills);
}

/**
 * Suggest skill options for an endorsement form.
 * Prioritizes developer’s own skills. Optionally filters by query substring.
 */
export async function getSkillOptionsForDeveloper(
  supabase: SupabaseClient,
  developerUserId: string,
  query?: string
): Promise<string[]> {
  const devSkills = await getDeveloperSkills(supabase, developerUserId);
  const base = devSkills.length ? devSkills : COMMON_SKILLS;
  if (!query) return base;

  const q = query.toLowerCase().trim();
  return base.filter((s) => s.includes(q));
}

/**
 * Fetch endorsements for a developer.
 * Includes both skill (back-compat, first item) and skills (array).
 */
export async function fetchEndorsements(
  supabase: SupabaseClient,
  developerUserId: string
): Promise<EndorsementRow[]> {
  const select = `
    id, created_at, developer_id, endorser_id, endorser_email, endorser_role,
    comment, is_anonymous, is_public, endorser_name, skill, skills,
    endorser_user:endorser_id(name, profile_pic_url, developers(public_profile_slug))
  `;

  const { data, error } = await supabase
    .from('endorsements')
    .select(select)
    .eq('developer_id', developerUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[endorsementUtils] fetchEndorsements error:', error.message);
    throw error;
  }

  // Ensure skills is always an array for consumers
  return (data ?? []).map((row) => ({
    ...row,
    skills: Array.isArray(row.skills) ? row.skills : row.skills ? [row.skills] : [],
  })) as EndorsementRow[];
}

/**
 * Default-exported wrapper to match existing imports:
 * import fetchEndorsementsForDeveloper from '../lib/endorsementUtils'
 */
export async function fetchEndorsementsForDeveloper(
  supabase: SupabaseClient,
  developerUserId: string
) {
  return fetchEndorsements(supabase, developerUserId);
}

/**
 * Create a new endorsement (with optional skills).
 * DB trigger creates a notification; your notify-user function emails the developer.
 */
export async function createEndorsement(
  supabase: SupabaseClient,
  input: CreateEndorsementInput
): Promise<EndorsementRow> {
  const payload = {
    developer_id: input.developer_id,
    comment: input.comment,
    endorser_name: input.endorser_name ?? null,
    endorser_email: input.endorser_email ?? null,
    endorser_role: input.endorser_role ?? null,
    is_public: input.is_public ?? true,
    is_anonymous: input.is_anonymous ?? false,
    skills: normalizeSkills(input.skills),
  };

  const { data, error } = await supabase
    .from('endorsements')
    .insert(payload)
    .select(
      `
      id, created_at, developer_id, endorser_id, endorser_email, endorser_role,
      comment, is_anonymous, is_public, endorser_name, skill, skills
      `
    )
    .single();

  if (error) {
    console.error('[endorsementUtils] createEndorsement error:', error.message);
    throw error;
  }

  return data as EndorsementRow;
}

/**
 * Update an endorsement. You can pass skills to change the set.
 */
export async function updateEndorsement(
  supabase: SupabaseClient,
  endorsementId: string,
  updates: UpdateEndorsementInput
): Promise<EndorsementRow> {
  const patch: Record<string, unknown> = { ...updates };
  if (updates.skills) {
    patch.skills = normalizeSkills(updates.skills);
  }

  const { data, error } = await supabase
    .from('endorsements')
    .update(patch)
    .eq('id', endorsementId)
    .select(
      `
      id, created_at, developer_id, endorser_id, endorser_email, endorser_role,
      comment, is_anonymous, is_public, endorser_name, skill, skills
      `
    )
    .single();

  if (error) {
    console.error('[endorsementUtils] updateEndorsement error:', error.message);
    throw error;
  }

  return data as EndorsementRow;
}

/**
 * Update only the visibility (is_public) of an endorsement.
 * This matches the named import used in DeveloperDashboard.tsx.
 */
export async function updateEndorsementVisibility(
  supabase: SupabaseClient,
  endorsementId: string,
  isPublic: boolean
): Promise<EndorsementRow> {
  const { data, error } = await supabase
    .from('endorsements')
    .update({ is_public: isPublic })
    .eq('id', endorsementId)
    .select(
      `
      id, created_at, developer_id, endorser_id, endorser_email, endorser_role,
      comment, is_anonymous, is_public, endorser_name, skill, skills
      `
    )
    .single();

  if (error) {
    console.error('[endorsementUtils] updateEndorsementVisibility error:', error.message);
    throw error;
  }

  return data as EndorsementRow;
}

/**
 * Optional: update anonymity flag if needed elsewhere.
 */
export async function updateEndorsementAnonymity(
  supabase: SupabaseClient,
  endorsementId: string,
  isAnonymous: boolean
): Promise<EndorsementRow> {
  const { data, error } = await supabase
    .from('endorsements')
    .update({ is_anonymous: isAnonymous })
    .eq('id', endorsementId)
    .select(
      `
      id, created_at, developer_id, endorser_id, endorser_email, endorser_role,
      comment, is_anonymous, is_public, endorser_name, skill, skills
      `
    )
    .single();

  if (error) {
    console.error('[endorsementUtils] updateEndorsementAnonymity error:', error.message);
    throw error;
  }

  return data as EndorsementRow;
}

/**
 * Optional helper for rendering. Falls back to the single "skill" if present.
 */
export function skillsDisplay(
  skills: string[] | null | undefined,
  fallbackSkill?: string | null
): string {
  const arr = normalizeSkills(skills ?? (fallbackSkill ? [fallbackSkill] : []));
  return arr.join(', ');
}

/**
 * A small curated fallback list used when a developer has no declared skills.
 */
export const COMMON_SKILLS: string[] = normalizeSkills([
  'javascript',
  'typescript',
  'react',
  'svelte',
  'node.js',
  'python',
  'go',
  'java',
  'ruby',
  'sql',
  'postgresql',
  'aws',
  'docker',
  'kubernetes',
  'graphql',
  'next.js',
  'vue',
  'c#',
  'php',
  'swift',
]);

/**
 * Convenience validator for the endorsement form.
 */
export function validateEndorsementInput(
  input: CreateEndorsementInput
): { ok: true } | { ok: false; message: string } {
  if (!input?.developer_id) return { ok: false, message: 'Missing developer_id' };
  if (!input?.comment || !input.comment.trim())
    return { ok: false, message: 'Please add a short comment.' };
  if (input.skills && normalizeSkills(input.skills).length > 10) {
    return { ok: false, message: 'A maximum of 10 skills can be selected.' };
  }
  return { ok: true };
}

export default fetchEndorsementsForDeveloper;

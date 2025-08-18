import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  createEndorsement,
  getSkillOptionsForDeveloper,
  normalizeSkills,
  COMMON_SKILLS,
} from '../lib/endorsementUtils';

// Helper to extract the developer user_id from route params or query string
function useDeveloperUserId(): string | null {
  const params = useParams();
  const location = useLocation();

  const fromParams =
    (params as any)?.developerId ||
    (params as any)?.userId ||
    (params as any)?.id ||
    (params as any)?.uid ||
    null;

  if (fromParams) return String(fromParams);

  const search = new URLSearchParams(location.search);
  const fromQuery =
    search.get('developerId') ||
    search.get('userId') ||
    search.get('id') ||
    search.get('uid');

  return fromQuery ? String(fromQuery) : null;
}

export default function EndorsementPage() {
  const developerUserId = useDeveloperUserId();

  const [comment, setComment] = useState('');
  const [endorserName, setEndorserName] = useState('');
  const [endorserEmail, setEndorserEmail] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const canSubmit = useMemo(() => {
    return !!developerUserId && comment.trim().length > 0 && !submitting;
  }, [developerUserId, comment, submitting]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!developerUserId) {
      setError('Unable to identify the developer to endorse.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setOk(false);
    try {
      await createEndorsement(supabase, {
        developer_id: developerUserId,
        comment,
        endorser_name: endorserName || null,
        endorser_email: endorserEmail || null,
        is_anonymous: isAnonymous,
        is_public: true,
        skills, // include selected skills
      });
      setOk(true);
      setComment('');
      setSkills([]);
      // You can navigate or reset as needed here
    } catch (err: any) {
      setError(err?.message || 'Failed to submit endorsement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Endorse this developer</h1>

      {!developerUserId && (
        <div style={{ marginBottom: 16, color: '#b91c1c', background: '#fee2e2', padding: 12, borderRadius: 8 }}>
          We couldn’t determine which developer you’re endorsing. Please return to the developer’s profile and click “Endorse”.
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div style={{ margin: '12px 0' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Your Endorsement</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            rows={5}
            placeholder="Write a short endorsement highlighting their strengths…"
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: 10 }}
          />
        </div>

        {/* New skills field */}
        {developerUserId && (
          <EndorsementSkillsField
            developerUserId={developerUserId}
            value={skills}
            onChange={setSkills}
          />
        )}

        <div style={{ margin: '12px 0' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Your Name</label>
          <input
            type="text"
            value={endorserName}
            onChange={(e) => setEndorserName(e.target.value)}
            placeholder="Optional"
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px' }}
          />
        </div>

        <div style={{ margin: '12px 0' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Your Email</label>
          <input
            type="email"
            value={endorserEmail}
            onChange={(e) => setEndorserEmail(e.target.value)}
            placeholder="Optional (we won’t share it publicly)"
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px' }}
          />
        </div>

        <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="anonymous"
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
          />
          <label htmlFor="anonymous">Post Anonymously</label>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            background: canSubmit ? '#4f46e5' : '#c7d2fe',
            color: '#fff',
            border: 'none',
            padding: '10px 14px',
            borderRadius: 8,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Endorsement'}
        </button>

        {error && <div style={{ color: '#b91c1c', marginTop: 10 }}>{error}</div>}
        {ok && <div style={{ color: '#065f46', marginTop: 10 }}>Thanks! Your endorsement has been submitted.</div>}
      </form>
    </div>
  );
}

/**
 * Inline Skills Field component so you don’t have to add another file.
 * It reuses the developer’s skills (with COMMON_SKILLS fallback) and normalizes selections.
 */
function EndorsementSkillsField({
  developerUserId,
  value,
  onChange,
  label = 'Skills (optional)',
  placeholder = 'Type a skill and press Enter…',
  max = 10,
  disabled = false,
}: {
  developerUserId: string;
  value: string[];
  onChange: (skills: string[]) => void;
  label?: string;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedSelected = useMemo(() => normalizeSkills(value, max), [value, max]);
  const remaining = max - normalizedSelected.length;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const opts = await getSkillOptionsForDeveloper(supabase, developerUserId, query);
        if (!cancelled) setOptions(opts);
      } catch {
        if (!cancelled) setOptions(COMMON_SKILLS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [developerUserId, query]);

  const addSkill = (raw: string) => {
    if (!raw) return;
    const s = raw.toLowerCase().trim();
    if (!s) return;
    const next = normalizeSkills([...normalizedSelected, s], max);
    onChange(next);
    setQuery('');
  };

  const removeSkill = (s: string) => {
    onChange(normalizedSelected.filter((x) => x !== s));
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (remaining <= 0) return;
      addSkill(query);
    } else if (e.key === 'Backspace' && !query && normalizedSelected.length) {
      removeSkill(normalizedSelected[normalizedSelected.length - 1]);
    }
  };

  const filteredSuggestions = useMemo(() => {
    const lower = query.toLowerCase().trim();
    const base = options.filter((opt) => !normalizedSelected.includes(opt));
    if (!lower) return base.slice(0, 10);
    return base.filter((opt) => opt.includes(lower)).slice(0, 10);
  }, [options, normalizedSelected, query]);

  return (
    <div style={{ margin: '12px 0' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{label}</label>

      <div
        style={{
          border: '1px solid #d1d5db',
          borderRadius: 8,
          padding: '8px 10px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          background: disabled ? '#f9fafb' : '#fff',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {normalizedSelected.map((s) => (
          <Chip key={s} label={s} onRemove={() => removeSkill(s)} disabled={disabled} />
        ))}

        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled || remaining <= 0}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={remaining <= 0 ? 'Max selected' : placeholder}
          style={{
            flex: 1,
            minWidth: 140,
            border: 'none',
            outline: 'none',
            padding: '6px 4px',
            background: 'transparent',
          }}
        />
      </div>

      {/* Suggestions */}
      {filteredSuggestions.length > 0 && query && (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            marginTop: -6,
            padding: 8,
            background: '#fff',
          }}
        >
          {filteredSuggestions.map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => addSkill(opt)}
              disabled={disabled || remaining <= 0}
              style={{
                display: 'inline-block',
                margin: '4px 6px 4px 0',
                padding: '6px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                background: '#f9fafb',
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          ))}
          {!loading && filteredSuggestions.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: 12 }}>No suggestions</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12 }}>
        {remaining} of {max} skills can be selected
      </div>
    </div>
  );
}

function Chip({
  label,
  onRemove,
  disabled,
}: {
  label: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: '#eef2ff',
        color: '#3730a3',
        border: '1px solid #c7d2fe',
        borderRadius: 999,
        fontSize: 12,
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${label}`}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#3730a3',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </span>
  );
}

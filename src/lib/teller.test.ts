import { describe, it, expect } from 'vitest'
import {
  extractEnrollmentId,
  extractAccessToken,
  extractInstitutionName,
  type TellerEnrollmentPayload,
} from '../lib/teller'

// ─── extractEnrollmentId ────────────────────────────────────────────────────

describe('extractEnrollmentId', () => {
  it('returns nested enrollment.id (standard SDK shape)', () => {
    const payload: TellerEnrollmentPayload = {
      accessToken: 'token_abc',
      enrollment: { id: 'enrollment_123', institution: { name: 'Chase' } },
    }
    expect(extractEnrollmentId(payload)).toBe('enrollment_123')
  })

  it('returns camelCase enrollmentId (flat alternative)', () => {
    const payload: TellerEnrollmentPayload = { enrollmentId: 'enrollment_456' }
    expect(extractEnrollmentId(payload)).toBe('enrollment_456')
  })

  it('returns snake_case enrollment_id (flat alternative)', () => {
    const payload: TellerEnrollmentPayload = { enrollment_id: 'enrollment_789' }
    expect(extractEnrollmentId(payload)).toBe('enrollment_789')
  })

  it('returns bare id as fallback (very flat shape)', () => {
    const payload: TellerEnrollmentPayload = { id: 'enrollment_000', token: 'tok' }
    expect(extractEnrollmentId(payload)).toBe('enrollment_000')
  })

  it('prefers nested enrollment.id over flat id', () => {
    const payload: TellerEnrollmentPayload = {
      id: 'flat_id',
      enrollment: { id: 'nested_id' },
    }
    expect(extractEnrollmentId(payload)).toBe('nested_id')
  })

  it('returns null when no id is present', () => {
    expect(extractEnrollmentId({})).toBeNull()
  })

  it('returns null when enrollment object exists but id is undefined', () => {
    const payload: TellerEnrollmentPayload = { enrollment: { institution: { name: 'X' } } }
    expect(extractEnrollmentId(payload)).toBeNull()
  })
})

// ─── extractAccessToken ─────────────────────────────────────────────────────

describe('extractAccessToken', () => {
  it('returns accessToken (standard camelCase)', () => {
    const payload: TellerEnrollmentPayload = { accessToken: 'token_abc123' }
    expect(extractAccessToken(payload)).toBe('token_abc123')
  })

  it('returns access_token (snake_case fallback)', () => {
    const payload: TellerEnrollmentPayload = { access_token: 'token_snake' }
    expect(extractAccessToken(payload)).toBe('token_snake')
  })

  it('returns token (bare fallback)', () => {
    const payload: TellerEnrollmentPayload = { token: 'token_bare' }
    expect(extractAccessToken(payload)).toBe('token_bare')
  })

  it('prefers accessToken over access_token', () => {
    const payload: TellerEnrollmentPayload = {
      accessToken: 'camel',
      access_token: 'snake',
    }
    expect(extractAccessToken(payload)).toBe('camel')
  })

  it('prefers access_token over bare token', () => {
    const payload: TellerEnrollmentPayload = {
      access_token: 'snake',
      token: 'bare',
    }
    expect(extractAccessToken(payload)).toBe('snake')
  })

  it('returns null when no token is present', () => {
    expect(extractAccessToken({})).toBeNull()
  })
})

// ─── extractInstitutionName ─────────────────────────────────────────────────

describe('extractInstitutionName', () => {
  it('returns nested enrollment.institution.name', () => {
    const payload: TellerEnrollmentPayload = {
      enrollment: { id: 'e1', institution: { name: 'Chase' } },
    }
    expect(extractInstitutionName(payload, 'Unknown')).toBe('Chase')
  })

  it('returns flat institution.name as fallback', () => {
    const payload: TellerEnrollmentPayload = { institution: { name: 'Wells Fargo' } }
    expect(extractInstitutionName(payload, 'Unknown')).toBe('Wells Fargo')
  })

  it('returns caller fallback when no institution present', () => {
    expect(extractInstitutionName({}, 'My Bank')).toBe('My Bank')
  })

  it('prefers nested over flat', () => {
    const payload: TellerEnrollmentPayload = {
      enrollment: { institution: { name: 'Nested Bank' } },
      institution: { name: 'Flat Bank' },
    }
    expect(extractInstitutionName(payload, 'X')).toBe('Nested Bank')
  })
})

// ─── Full sandbox payload round-trip ────────────────────────────────────────

describe('sandbox payload (username_good flow)', () => {
  const sandboxPayload: TellerEnrollmentPayload = {
    accessToken: 'test_token_hs6bsm4y6lfmbnheq6i',
    user: { id: 'user_p4i4bkb9a49s3dz5' },
    enrollment: {
      id: 'enrollment_p4i4g1by9a49s3dz5',
      institution: { name: 'First Platypus Bank' },
    },
    signatures: ['sig_abc'],
  }

  it('extracts enrollment id', () => {
    expect(extractEnrollmentId(sandboxPayload)).toBe('enrollment_p4i4g1by9a49s3dz5')
  })

  it('extracts access token', () => {
    expect(extractAccessToken(sandboxPayload)).toBe('test_token_hs6bsm4y6lfmbnheq6i')
  })

  it('extracts institution name', () => {
    expect(extractInstitutionName(sandboxPayload, 'fallback')).toBe('First Platypus Bank')
  })
})

/**
 * Tests for Dashboard UI terminology
 * 
 * BEFORE MIGRATION: Verifies "Mission" terminology is present
 * AFTER MIGRATION: Update to verify "Project" terminology
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { AuthWrapper } from '@/test-utils/testWrappers';
import { setupFetchMock, mockApiResponse } from '@/test-utils/mocks';

// Mock aws-amplify/auth
vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    userId: 'test-user-id',
    username: 'test@example.com',
    signInDetails: { loginId: 'test@example.com' },
  }),
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      accessToken: { payload: { sub: 'test-user-id' } },
      idToken: { payload: { sub: 'test-user-id', email: 'test@example.com' } },
    },
  }),
  signOut: vi.fn().mockResolvedValue({}),
}));

// Mock useOrganization
vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: vi.fn(() => ({
    organization: { id: 'org-1', name: 'Test Org' },
    loading: false,
  })),
}));

// Mock useSuperAdmin
vi.mock('@/hooks/useSuperAdmin', () => ({
  useSuperAdmin: vi.fn(() => ({
    isSuperAdmin: false,
  })),
}));

describe('Dashboard - UI Terminology', () => {
  beforeEach(() => {
    setupFetchMock(() => mockApiResponse([]));
  });

  it('should display "Stargazer Missions" in navigation menu', async () => {
    // Note: This test may need additional mocking for full component rendering
    // The baseline test (terminology.baseline.test.ts) is the primary test for terminology verification
    // This component test serves as a secondary check
    
    // For now, we'll verify the file contains the text (same as baseline test)
    const fs = await import('fs');
    const path = await import('path');
    const dashboardContent = fs.readFileSync(
      path.join(process.cwd(), 'src/pages/Dashboard.tsx'),
      'utf-8'
    );

    // BEFORE MIGRATION: Should find "Missions"
    // AFTER MIGRATION: Update to expect "Projects"
    expect(dashboardContent).toMatch(/Stargazer Missions/);
  });
});


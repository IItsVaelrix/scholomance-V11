import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AgentStatus from '../../../src/pages/Collab/AgentStatus';
import AgentLoginModal from '../../../src/pages/Collab/AgentLoginModal';
import React from 'react';

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }) => <div {...props}>{children}</div>,
        article: ({ children, ...props }) => <article {...props}>{children}</article>,
        header: ({ children, ...props }) => <header {...props}>{children}</header>,
    },
    AnimatePresence: ({ children }) => <>{children}</>,
}));

describe('AgentStatus', () => {
    const mockAgents = [
        {
            id: 'agent-1',
            name: 'Test Agent 1',
            role: 'backend',
            status: 'online',
            last_seen: new Date().toISOString(),
            capabilities: ['node'],
        },
        {
            id: 'agent-2',
            name: 'Test Agent 2',
            role: 'ui',
            status: 'offline',
            last_seen: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // Stale
            capabilities: ['jsx'],
        }
    ];

    it('renders agent list and categories', () => {
        render(<AgentStatus agents={mockAgents} nowMs={Date.now()} />);
        
        expect(screen.getByText('Connected Minds')).toBeDefined();
        expect(screen.getByText('Disconnected Echoes')).toBeDefined();
        expect(screen.getByText('Test Agent 1')).toBeDefined();
        expect(screen.getByText('Test Agent 2')).toBeDefined();
    });

    it('triggers login modal on button click', async () => {
        render(<AgentStatus agents={mockAgents} nowMs={Date.now()} />);
        
        const loginButtons = screen.getAllByText('Log In');
        fireEvent.click(loginButtons[0]);
        
        // Modal should be visible (we can check for its title)
        expect(screen.getByText('Log In Agent')).toBeDefined();
    });
});

describe('AgentLoginModal', () => {
    it('does not render when closed', () => {
        const { queryByText } = render(
            <AgentLoginModal isOpen={false} onClose={() => {}} onSuccess={() => {}} />
        );
        expect(queryByText('Log In Agent')).toBeNull();
    });

    it('renders form fields when open', () => {
        render(<AgentLoginModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);

        expect(screen.getByLabelText('Agent ID')).toBeDefined();
        expect(screen.getByLabelText('Display Name')).toBeDefined();
        expect(screen.getByText('Role')).toBeDefined();
        expect(screen.getByLabelText('Capabilities (optional)')).toBeDefined();
    });
});

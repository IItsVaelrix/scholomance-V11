import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VowelFamilyPanel from '../../src/components/VowelFamilyPanel.jsx';

describe('VowelFamilyPanel', () => {
  it('shows neutral empty-state guidance without Truesight dependency language', () => {
    render(
      <VowelFamilyPanel
        visible={true}
        families={[]}
        totalWords={0}
        uniqueWords={0}
        isEmbedded={true}
      />
    );

    expect(screen.getByText('No vowel-family data yet.')).toBeInTheDocument();
    expect(screen.getByText('Add some verse to see phoneme breakdown.')).toBeInTheDocument();
    expect(screen.queryByText('Enable Truesight and add some verse.')).not.toBeInTheDocument();
  });

  it('does not render when hidden', () => {
    const { container } = render(
      <VowelFamilyPanel visible={false} families={[]} totalWords={0} uniqueWords={0} />
    );

    expect(container.firstChild).toBeNull();
  });
});

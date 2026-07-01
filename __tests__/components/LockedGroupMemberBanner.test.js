import React from 'react';
import { act, create } from 'react-test-renderer';

import LockedGroupMemberBanner from '../../components/Groups/LockedGroupMemberBanner';

describe('LockedGroupMemberBanner', () => {
  function render(props = {}) {
    let renderer;
    act(() => {
      renderer = create(<LockedGroupMemberBanner {...props} />);
    });
    return renderer;
  }

  it('renders the banner container with the locked messaging', () => {
    const renderer = render({ groupName: 'Waldos' });

    const container = renderer.root.findByProps({ testID: 'private-home.locked-member-banner' });
    expect(container).toBeTruthy();

    const texts = renderer.root.findAllByType('Text');
    const joined = texts.map((t) => t.props.children).join('\n');
    expect(joined).toContain('Waldos is temporarily locked');
    expect(joined).toContain("owner's Premium+ subscription ended");
    expect(joined).toContain('read-only');
  });

  it('uses a generic label when no group name is supplied', () => {
    const renderer = render();

    const texts = renderer.root.findAllByType('Text');
    const joined = texts.map((t) => t.props.children).join('\n');
    expect(joined).toContain('This group is temporarily locked');
  });
});

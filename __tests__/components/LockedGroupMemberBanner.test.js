import React from 'react';
import { act, create } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import LockedGroupMemberBanner from '../../components/Groups/LockedGroupMemberBanner';
import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';

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

  it('uses the private group palette for the banner surface', () => {
    const theme = getPrivateGroupTheme({ primaryColor: '#198868', secondaryColor: '#FFCC00' });
    const renderer = render({ groupName: 'Waldos', primaryColor: '#198868', secondaryColor: '#FFCC00' });

    const container = renderer.root.findByProps({ testID: 'private-home.locked-member-banner' });
    const style = StyleSheet.flatten(container.props.style);
    expect(style.backgroundColor).toBe(theme.surface);
    expect(style.borderColor).toBe(theme.warning);
  });
});

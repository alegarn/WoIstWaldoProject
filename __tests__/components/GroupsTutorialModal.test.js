import React from 'react';
import { act, create } from 'react-test-renderer';

import GroupsTutorialModal from '../../components/UI/GroupsTutorialModal';

function findByTestID(root, testID) {
  return root.findAll(node => node.props && node.props.testID === testID);
}

function findText(root, text) {
  return root.findAll(node => typeof node.props?.children === 'string' && node.props.children === text)[0];
}

function collectText(root) {
  return root
    .findAll(node => typeof node.props?.children === 'string')
    .map(node => node.props.children);
}

describe('GroupsTutorialModal', () => {
  let renderer = null;

  afterEach(() => {
    if (renderer) {
      const unmountRenderer = renderer;
      act(() => {
        unmountRenderer.unmount();
      });
    }
    renderer = null;
  });

  function renderModal(visible = true, onDone = jest.fn()) {
    return create(<GroupsTutorialModal visible={visible} onDone={onDone} />);
  }

  function press(root, testID) {
    act(() => {
      findByTestID(root, testID)[0].props.onPress();
    });
  }

  it('renders nothing when visible is false', () => {
    act(() => {
      renderer = renderModal(false);
    });
    expect(renderer.toJSON()).toBeNull();
  });

  it('shows the page1 panel first with the backdrop and card', () => {
    act(() => {
      renderer = renderModal();
    });
    const root = renderer.root;

    expect(findByTestID(root, 'groupsTutorial.backdrop').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'groupsTutorial.card').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'groupsTutorial.panel.page1').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'groupsTutorial.panel.page2').length).toBe(0);
    expect(findByTestID(root, 'groupsTutorial.panel.page3').length).toBe(0);
    expect(findByTestID(root, 'groupsTutorial.panel.page4').length).toBe(0);
    expect(findText(root, 'Play privately')).toBeDefined();
    expect(findText(root, 'Create a private space and hide Waldo just for the people you invite.')).toBeDefined();
  });

  it('advances through page1..page4 in order and swaps next for done on the last page', () => {
    act(() => {
      renderer = renderModal();
    });
    const root = renderer.root;

    press(root, 'groupsTutorial.next');
    expect(findByTestID(root, 'groupsTutorial.panel.page2').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'groupsTutorial.panel.page1').length).toBe(0);
    expect(findText(root, 'Join for free')).toBeDefined();
    expect(findText(root, "Enter a friend's group code and you're in — joining is always free.")).toBeDefined();
    expect(findByTestID(root, 'groupsTutorial.done').length).toBe(0);

    press(root, 'groupsTutorial.next');
    expect(findByTestID(root, 'groupsTutorial.panel.page3').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'groupsTutorial.panel.page2').length).toBe(0);
    expect(findText(root, 'Create for free')).toBeDefined();
    expect(findText(root, 'Creating a group is free: 1 group with up to 10 members.')).toBeDefined();
    expect(findByTestID(root, 'groupsTutorial.done').length).toBe(0);

    press(root, 'groupsTutorial.next');
    expect(findByTestID(root, 'groupsTutorial.panel.page4').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'groupsTutorial.panel.page3').length).toBe(0);
    expect(findText(root, 'Make it yours')).toBeDefined();
    expect(findText(root, 'Personalize your group in the Store — custom images, categories and colors.')).toBeDefined();
    expect(findByTestID(root, 'groupsTutorial.next').length).toBe(0);
    expect(findByTestID(root, 'groupsTutorial.done').length).toBeGreaterThan(0);
  });

  it('calls onDone exactly once from the done button on the last page', () => {
    const onDone = jest.fn();
    act(() => {
      renderer = renderModal(true, onDone);
    });
    const root = renderer.root;

    expect(findByTestID(root, 'groupsTutorial.done').length).toBe(0);

    press(root, 'groupsTutorial.next');
    press(root, 'groupsTutorial.next');
    press(root, 'groupsTutorial.next');

    press(root, 'groupsTutorial.done');

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone exactly once from the skip button on the first page', () => {
    const onDone = jest.fn();
    act(() => {
      renderer = renderModal(true, onDone);
    });
    const root = renderer.root;

    press(root, 'groupsTutorial.skip');

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('never shows copy matching /unlock/i on any panel', () => {
    act(() => {
      renderer = renderModal();
    });
    const root = renderer.root;

    const seenText = [...collectText(root)];
    press(root, 'groupsTutorial.next');
    seenText.push(...collectText(root));
    press(root, 'groupsTutorial.next');
    seenText.push(...collectText(root));
    press(root, 'groupsTutorial.next');
    seenText.push(...collectText(root));

    const offenders = seenText.filter(text => /unlock/i.test(text));
    expect(offenders).toEqual([]);
    expect(seenText.length).toBeGreaterThan(0);
  });
});

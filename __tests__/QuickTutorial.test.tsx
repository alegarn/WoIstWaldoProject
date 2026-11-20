import React from 'react';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import QuickTutorial from '../components/UI/QuickTutorial';

function findByTestID(root: ReactTestInstance, testID: string): ReactTestInstance[] {
  return root.findAll(node => node.props && node.props.testID === testID);
}

function findText(root: ReactTestInstance, text: string): ReactTestInstance | undefined {
  return root.findAll(node => typeof node.props?.children === 'string' && node.props.children === text)[0];
}

function render(visible = true): ReactTestRenderer {
  return create(<QuickTutorial visible={visible} onDone={jest.fn()} />);
}

describe('QuickTutorial', () => {
  let renderer: ReactTestRenderer | null;
  afterEach(() => {
    if (renderer) {
      const r = renderer;
      act(() => { r.unmount(); });
    }
    renderer = null;
  });

  it('renders nothing when visible is false', () => {
    act(() => {
      renderer = render(false);
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('shows the hide panel first with the internationalized home button label', () => {
    act(() => {
      renderer = render();
    });
    const root = renderer!.root;

    expect(findByTestID(root, 'tutorial.quick.panel.hide').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'tutorial.quick.panel.guess').length).toBe(0);
    expect(findByTestID(root, 'tutorial.quick.panel.ranking').length).toBe(0);
    expect(findText(root, 'Hide Waldo')).toBeDefined();
  });

  it('advances through guess and ranking panels with the home button labels', () => {
    act(() => {
      renderer = render();
    });
    const root = renderer!.root;

    act(() => {
      findByTestID(root, 'tutorial.quick.next')[0].props.onPress();
    });
    expect(findByTestID(root, 'tutorial.quick.panel.guess').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'tutorial.quick.panel.hide').length).toBe(0);
    expect(findText(root, 'Find Waldo')).toBeDefined();

    act(() => {
      findByTestID(root, 'tutorial.quick.next')[0].props.onPress();
    });
    expect(findByTestID(root, 'tutorial.quick.panel.ranking').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'tutorial.quick.panel.guess').length).toBe(0);
    expect(findText(root, 'Ranking')).toBeDefined();
  });

  it('interpolates the button text into the panel explanation', () => {
    act(() => {
      renderer = render();
    });
    const root = renderer!.root;

    const bodyText = root
      .findAll(node => typeof node.props?.children === 'string')
      .map(node => node.props.children as string)
      .find(text => text.includes('which point of the image you described'));

    expect(bodyText).toBeDefined();
    expect(bodyText!).toContain('"Hide Waldo"');
  });

  it('calls onDone from the done button on the last panel', () => {
    const onDone = jest.fn();
    act(() => {
      renderer = create(<QuickTutorial visible={true} onDone={onDone} />);
    });
    const root = renderer!.root;

    expect(findByTestID(root, 'tutorial.quick.done').length).toBe(0);

    act(() => {
      findByTestID(root, 'tutorial.quick.next')[0].props.onPress();
    });
    act(() => {
      findByTestID(root, 'tutorial.quick.next')[0].props.onPress();
    });

    const doneButton = findByTestID(root, 'tutorial.quick.done')[0];
    act(() => {
      doneButton.props.onPress();
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone from the skip button', () => {
    const onDone = jest.fn();
    act(() => {
      renderer = create(<QuickTutorial visible={true} onDone={onDone} />);
    });
    const root = renderer!.root;

    act(() => {
      findByTestID(root, 'tutorial.quick.skip')[0].props.onPress();
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does not throw on mount and unmount', () => {
    expect(() => {
      act(() => {
        renderer = render();
      });
      act(() => {
        renderer!.unmount();
      });
    }).not.toThrow();
    renderer = null;
  });
});

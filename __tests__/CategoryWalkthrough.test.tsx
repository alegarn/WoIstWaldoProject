import React from 'react';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import CategoryWalkthrough from '../components/UI/CategoryWalkthrough';
import { GlobalStyle } from '../constants/theme';

function findByTestID(root: ReactTestInstance, testID: string): ReactTestInstance[] {
  return root.findAll(node => node.props && node.props.testID === testID);
}

function findText(root: ReactTestInstance, text: string): ReactTestInstance | undefined {
  return root.findAll(node => typeof node.props?.children === 'string' && node.props.children === text)[0];
}

function isDotActive(node: ReactTestInstance): boolean {
  const style = node.props?.style;
  return Array.isArray(style) && style.some(
    (entry) => entry?.backgroundColor === GlobalStyle.color.secondaryColor
  );
}

function render(visible = true, onDone = jest.fn()): ReactTestRenderer {
  return create(<CategoryWalkthrough visible={visible} onDone={onDone} />);
}

describe('CategoryWalkthrough', () => {
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

  it('shows the goal panel first without a mock button', () => {
    act(() => {
      renderer = render();
    });
    const root = renderer!.root;

    expect(findByTestID(root, 'tutorial.guessWalkthrough.panel.goal').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panel.language').length).toBe(0);
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panel.mode').length).toBe(0);
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panelLabel').length).toBe(0);
  });

  it('advances through language and mode panels with the screen control labels', () => {
    act(() => {
      renderer = render();
    });
    const root = renderer!.root;

    act(() => {
      findByTestID(root, 'tutorial.guessWalkthrough.next')[0].props.onPress();
    });
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panel.language').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panel.goal').length).toBe(0);
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panelLabel').length).toBeGreaterThan(0);
    expect(findText(root, 'Open language filter')).toBeDefined();

    act(() => {
      findByTestID(root, 'tutorial.guessWalkthrough.next')[0].props.onPress();
    });
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panel.mode').length).toBeGreaterThan(0);
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panel.language').length).toBe(0);
    expect(findText(root, 'Open mode filter')).toBeDefined();
  });

  it('interpolates the language filter label into the page 2 body', () => {
    act(() => {
      renderer = render();
    });
    const root = renderer!.root;

    act(() => {
      findByTestID(root, 'tutorial.guessWalkthrough.next')[0].props.onPress();
    });

    const bodyText = root
      .findAll(node => typeof node.props?.children === 'string')
      .map(node => node.props.children as string)
      .find(text => text.includes('filters which language'));

    expect(bodyText).toBeDefined();
    expect(bodyText!).toContain('"Open language filter"');
  });

  it('calls onDone exactly once from the done button on the last page', () => {
    const onDone = jest.fn();
    act(() => {
      renderer = create(<CategoryWalkthrough visible={true} onDone={onDone} />);
    });
    const root = renderer!.root;

    expect(findByTestID(root, 'tutorial.guessWalkthrough.done').length).toBe(0);

    act(() => {
      findByTestID(root, 'tutorial.guessWalkthrough.next')[0].props.onPress();
    });
    act(() => {
      findByTestID(root, 'tutorial.guessWalkthrough.next')[0].props.onPress();
    });

    const doneButton = findByTestID(root, 'tutorial.guessWalkthrough.done')[0];
    act(() => {
      doneButton.props.onPress();
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone from the skip button on the first page', () => {
    const onDone = jest.fn();
    act(() => {
      renderer = create(<CategoryWalkthrough visible={true} onDone={onDone} />);
    });
    const root = renderer!.root;

    act(() => {
      findByTestID(root, 'tutorial.guessWalkthrough.skip')[0].props.onPress();
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('renders three dots tracking the active page', () => {
    act(() => {
      renderer = render();
    });
    let root = renderer!.root;

    const dotTestIDs = [
      'tutorial.guessWalkthrough.dot.goal',
      'tutorial.guessWalkthrough.dot.language',
      'tutorial.guessWalkthrough.dot.mode',
    ];
    const renderedDotTestIDs = new Set(
      root
        .findAll(node => typeof node.props?.testID === 'string' && dotTestIDs.includes(node.props.testID))
        .map(node => node.props.testID)
    );
    expect(renderedDotTestIDs.size).toBe(3);
    expect(isDotActive(findByTestID(root, 'tutorial.guessWalkthrough.dot.goal')[0])).toBe(true);
    expect(isDotActive(findByTestID(root, 'tutorial.guessWalkthrough.dot.language')[0])).toBe(false);

    act(() => {
      findByTestID(root, 'tutorial.guessWalkthrough.next')[0].props.onPress();
    });
    root = renderer!.root;
    expect(isDotActive(findByTestID(root, 'tutorial.guessWalkthrough.dot.goal')[0])).toBe(false);
    expect(isDotActive(findByTestID(root, 'tutorial.guessWalkthrough.dot.language')[0])).toBe(true);

    act(() => {
      findByTestID(root, 'tutorial.guessWalkthrough.next')[0].props.onPress();
    });
    root = renderer!.root;
    expect(isDotActive(findByTestID(root, 'tutorial.guessWalkthrough.dot.language')[0])).toBe(false);
    expect(isDotActive(findByTestID(root, 'tutorial.guessWalkthrough.dot.mode')[0])).toBe(true);
  });

  it('resets to the first page when reopened', () => {
    act(() => {
      renderer = render();
    });
    let root = renderer!.root;

    act(() => {
      findByTestID(root, 'tutorial.guessWalkthrough.next')[0].props.onPress();
    });
    root = renderer!.root;
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panel.language').length).toBeGreaterThan(0);

    act(() => {
      renderer!.update(<CategoryWalkthrough visible={false} onDone={jest.fn()} />);
    });
    act(() => {
      renderer!.update(<CategoryWalkthrough visible={true} onDone={jest.fn()} />);
    });
    root = renderer!.root;
    expect(findByTestID(root, 'tutorial.guessWalkthrough.panel.goal').length).toBeGreaterThan(0);
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

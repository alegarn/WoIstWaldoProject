import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';

import {
  PrivateGroupThemeProvider,
  usePrivateGroupTheme,
  useAccentColor,
  useGroupSurfaceColor,
  useScopedPrivateGroupTheme,
} from '../../store/privateGroupTheme-context';
import { GlobalStyle } from '../../constants/theme';
import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';

const mockUseActiveGroup = jest.fn();
const mockUseGroupsHub = jest.fn();

jest.mock('../../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
}));

function ThemeProbe({ onValue }) {
  const theme = usePrivateGroupTheme();
  useEffect(() => {
    onValue(theme);
  }, [onValue, theme]);
  return null;
}

function AccentProbe({ onValue }) {
  const accent = useAccentColor();
  useEffect(() => {
    onValue(accent);
  }, [onValue, accent]);
  return null;
}

function SurfaceProbe({ onValue }) {
  const surface = useGroupSurfaceColor();
  useEffect(() => {
    onValue(surface);
  }, [onValue, surface]);
  return null;
}

function ScopedThemeProbe({ scopeOverride, onValue }) {
  const value = useScopedPrivateGroupTheme(scopeOverride);
  useEffect(() => {
    onValue(value);
  }, [onValue, value]);
  return null;
}

describe('PrivateGroupThemeContext', () => {
  it('usePrivateGroupTheme returns null when rendered outside any provider', async () => {
    let theme;
    await act(async () => {
      create(<ThemeProbe onValue={(value) => { theme = value; }} />);
    });
    expect(theme).toBeNull();
  });

  it('usePrivateGroupTheme returns the memoized theme whose primaryColor is the normalized group primary_color', async () => {
    let theme;
    await act(async () => {
      create(
        <PrivateGroupThemeProvider group={{ primary_color: '#198868', secondary_color: '#FFCC00' }}>
          <ThemeProbe onValue={(value) => { theme = value; }} />
        </PrivateGroupThemeProvider>
      );
    });
    expect(theme).not.toBeNull();
    expect(theme.primaryColor).toBe('#198868');
  });

  it('memoizes the theme across renders with the same colors and returns a new object when colors change', async () => {
    let firstTheme;
    let sameColorsTheme;
    let changedColorsTheme;

    let renderer;
    await act(async () => {
      renderer = create(
        <PrivateGroupThemeProvider group={{ primary_color: '#198868', secondary_color: '#FFCC00' }}>
          <ThemeProbe onValue={(value) => { firstTheme = value; }} />
        </PrivateGroupThemeProvider>
      );
    });

    await act(async () => {
      renderer.update(
        <PrivateGroupThemeProvider group={{ primary_color: '#198868', secondary_color: '#FFCC00' }}>
          <ThemeProbe onValue={(value) => { sameColorsTheme = value; }} />
        </PrivateGroupThemeProvider>
      );
    });

    expect(sameColorsTheme).toBe(firstTheme);

    await act(async () => {
      renderer.update(
        <PrivateGroupThemeProvider group={{ primary_color: '#FF0000', secondary_color: '#FFCC00' }}>
          <ThemeProbe onValue={(value) => { changedColorsTheme = value; }} />
        </PrivateGroupThemeProvider>
      );
    });

    expect(changedColorsTheme).not.toBe(firstTheme);
    expect(changedColorsTheme.primaryColor).toBe('#FF0000');
  });

  it('useAccentColor falls back to GlobalStyle.color.primaryColor500 outside a provider', async () => {
    let accent;
    await act(async () => {
      create(<AccentProbe onValue={(value) => { accent = value; }} />);
    });
    expect(accent).toBe(GlobalStyle.color.primaryColor500);
  });

  it('useGroupSurfaceColor falls back to GlobalStyle.color.primaryColor900 outside a provider', async () => {
    let surface;
    await act(async () => {
      create(<SurfaceProbe onValue={(value) => { surface = value; }} />);
    });
    expect(surface).toBe(GlobalStyle.color.primaryColor900);
  });

  it('PrivateGroupThemeProvider with group=null yields a null context (public scope guard)', async () => {
    let theme;
    await act(async () => {
      create(
        <PrivateGroupThemeProvider group={null}>
          <ThemeProbe onValue={(value) => { theme = value; }} />
        </PrivateGroupThemeProvider>
      );
    });
    expect(theme).toBeNull();
  });
});

describe('useScopedPrivateGroupTheme', () => {
  beforeEach(() => {
    mockUseActiveGroup.mockReset();
    mockUseGroupsHub.mockReset();
    mockUseActiveGroup.mockReturnValue({ scope: { kind: 'public' } });
    mockUseGroupsHub.mockReturnValue({ data: { owned: [], joined: [] } });
  });

  it('returns all-null/false when the active scope is public and no override is given', async () => {
    let value;
    await act(async () => {
      create(<ScopedThemeProbe onValue={(v) => { value = v; }} />);
    });
    expect(value).toEqual({ group: null, theme: null, isPrivate: false });
  });

  it('resolves the group and theme from a private route override', async () => {
    mockUseActiveGroup.mockReturnValue({ scope: { kind: 'public' } });
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [{ id: 'g-1', name: 'Waldos', primary_color: '#198868', secondary_color: '#FFCC00' }],
        joined: [],
      },
    });

    let value;
    await act(async () => {
      create(
        <ScopedThemeProbe
          scopeOverride={{ kind: 'private', groupId: 'g-1' }}
          onValue={(v) => { value = v; }}
        />
      );
    });

    expect(value.isPrivate).toBe(true);
    expect(value.group.id).toBe('g-1');
    expect(value.theme.primaryColor).toBe(
      getPrivateGroupTheme({ primaryColor: '#198868' }).primaryColor,
    );
  });

  it('lets the route override take precedence over the active scope when their groupIds differ', async () => {
    mockUseActiveGroup.mockReturnValue({ scope: { kind: 'private', groupId: 'g-active' } });
    mockUseGroupsHub.mockReturnValue({
      data: {
        owned: [
          { id: 'g-active', name: 'Active', primary_color: '#FF0000' },
          { id: 'g-route', name: 'Route', primary_color: '#00FF00' },
        ],
        joined: [],
      },
    });

    let value;
    await act(async () => {
      create(
        <ScopedThemeProbe
          scopeOverride={{ kind: 'private', groupId: 'g-route' }}
          onValue={(v) => { value = v; }}
        />
      );
    });

    expect(value.isPrivate).toBe(true);
    expect(value.group.id).toBe('g-route');
    expect(value.theme.primaryColor).toBe(
      getPrivateGroupTheme({ primaryColor: '#00FF00' }).primaryColor,
    );
  });
});

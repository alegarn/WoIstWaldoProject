import { createContext, useContext, useMemo } from "react";

import { GlobalStyle } from "../constants/theme";
import { useActiveGroup } from "../hooks/useActiveGroup";
import { useGroupsHub } from "../hooks/useGroupsHub";
import { getPrivateGroupTheme } from "../utils/privateGroupTheme";

const PrivateGroupThemeContext = createContext(null);

export function PrivateGroupThemeProvider({ group, children }) {
  const theme = useMemo(
    () => getPrivateGroupTheme({
      primaryColor: group?.primary_color,
      secondaryColor: group?.secondary_color,
    }),
    [group?.primary_color, group?.secondary_color],
  );

  const value = group ? theme : null;

  return (
    <PrivateGroupThemeContext.Provider value={value}>
      {children}
    </PrivateGroupThemeContext.Provider>
  );
}

export function usePrivateGroupTheme() {
  return useContext(PrivateGroupThemeContext);
}

export function useAccentColor() {
  return usePrivateGroupTheme()?.primaryColor ?? GlobalStyle.color.primaryColor500;
}

export function useGroupSurfaceColor() {
  return usePrivateGroupTheme()?.screen ?? GlobalStyle.color.primaryColor900;
}

export function useScopedPrivateGroupTheme(routeScopeOverride) {
  const { scope: activeScope } = useActiveGroup();
  const { data } = useGroupsHub();
  const scope = routeScopeOverride ?? activeScope;
  const isPrivate = !!(scope?.kind === 'private' && scope?.groupId);
  const group = useMemo(() => {
    if (!isPrivate) return null;
    const all = [...(data?.owned ?? []), ...(data?.joined ?? [])];
    return all.find((g) => g.id === scope.groupId) ?? null;
  }, [isPrivate, scope?.groupId, data]);
  const theme = useMemo(
    () => group
      ? getPrivateGroupTheme({ primaryColor: group.primary_color, secondaryColor: group.secondary_color })
      : null,
    [group],
  );
  return { group, theme, isPrivate };
}

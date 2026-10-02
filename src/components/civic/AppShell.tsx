import { Link, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';

import { useT } from '../../i18n';
import { AREAS, BREAKPOINT, isActive, visibleAreas, type Area } from '../../navigation/areas';
import { useSession } from '../../navigation/SessionContext';
import { size, space, useTheme } from '../../theme';
import { CivicText } from './CivicText';
import { EmergencyNotice } from './EmergencyNotice';

const MAIN_ID = 'main-content';

function SkipLink() {
  const t = useT();
  const { color } = useTheme();
  const [focused, setFocused] = useState(false);
  // Off screen until focused, so it is the first stop for keyboard users.
  return (
    <Pressable
      role="link"
      accessibilityLabel={t('nav.skip')}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => {
        if (Platform.OS === 'web') document.getElementById(MAIN_ID)?.focus();
      }}
      style={{
        position: 'absolute',
        top: space('2'),
        start: focused ? space('2') : -10000,
        zIndex: 10,
        minHeight: size.minTarget,
        minWidth: size.minTarget,
        justifyContent: 'center',
        padding: space('3'),
        backgroundColor: color.surface,
        borderWidth: 2,
        borderColor: color.focus,
      }}
    >
      <CivicText variant="label">{t('nav.skip')}</CivicText>
    </Pressable>
  );
}

function NavItem({ area, active, wide }: { area: Area; active: boolean; wide: boolean }) {
  const t = useT();
  const { color } = useTheme();
  const label = t(area.label);
  return (
    <Link href={area.href as never} asChild>
      <Pressable
        role="link"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        aria-current={active ? 'page' : undefined}
        style={{
          minHeight: size.minTarget,
          minWidth: size.minTarget,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: space('3'),
          flex: wide ? undefined : 1,
          borderBottomWidth: 3,
          borderBottomColor: active ? color.primary : 'transparent',
        }}
      >
        {/* Underline and strong weight mark the current area: never colour alone. */}
        <CivicText variant={active ? 'bodyStrong' : 'body'} underline={active}>
          {label}
        </CivicText>
      </Pressable>
    </Link>
  );
}

function NavBar({ wide }: { wide: boolean }) {
  const t = useT();
  const { color } = useTheme();
  const session = useSession();
  const path = usePathname();
  return (
    <View
      role="navigation"
      accessibilityLabel={t('nav.label')}
      style={{
        flexDirection: 'row',
        backgroundColor: color.surface,
        [wide ? 'borderBottomWidth' : 'borderTopWidth']: 1,
        borderColor: color.border,
        paddingHorizontal: wide ? space('4') : 0,
      }}
    >
      {visibleAreas(session).map((a) => (
        <NavItem key={a.href} area={a} active={isActive(a.href, path)} wide={wide} />
      ))}
    </View>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const path = usePathname();
  const { width } = useWindowDimensions();
  const wide = width >= BREAKPOINT;
  const current = AREAS.find((a) => isActive(a.href, path));
  const title = current ? `${t(current.label)} - ${t('common.appName')}` : t('common.appName');
  return (
    <View style={{ flex: 1 }}>
      <Head>
        <title>{title}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <SkipLink />
      {wide ? <NavBar wide /> : null}
      <View
        nativeID={MAIN_ID}
        role="main"
        tabIndex={-1}
        style={{ flex: 1, outlineStyle: 'none' } as never}
      >
        {children}
      </View>
      <EmergencyNotice />
      {wide ? null : <NavBar wide={false} />}
    </View>
  );
}

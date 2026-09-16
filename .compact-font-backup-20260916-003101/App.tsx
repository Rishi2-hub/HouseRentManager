
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as NativeStatusBar,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  StatusBar,
} from 'expo-status-bar';

import {
  initDb,
  listBills,
  listFloors,
  listRooms,
  listTenants,
} from './src/db/database';

import {
  supabase,
} from './src/lib/supabase';

import {
  syncPending,
} from './src/services/sync';

import {
  Bill,
  Floor,
  Room,
  Tab,
  Tenant,
} from './src/types';

import {
  colors,
} from './src/theme';

import {
  AuthScreen,
} from './src/screens/AuthScreen';

import {
  DashboardScreen,
} from './src/screens/DashboardScreen';

import {
  PropertiesScreen,
} from './src/screens/PropertiesScreen';

import {
  TenantsScreen,
} from './src/screens/TenantsScreen';

import {
  BillsScreen,
} from './src/screens/BillsScreen';

import {
  SettingsScreen,
} from './src/screens/SettingsScreen';

import {
  BiometricLock,
} from './src/components/BiometricLock';

const tabs: Tab[] = [
  'Dashboard',
  'Properties',
  'Tenants',
  'Bills',
  'Settings',
];

const tabIcons: Record<Tab, string> = {
  Dashboard: '⌂',
  Properties: '▦',
  Tenants: '♟',
  Bills: '▤',
  Settings: '⚙',
};

export default function App() {
  const [ready, setReady] =
    useState(false);

  const [loggedIn, setLoggedIn] =
    useState(false);

  const [displayName, setDisplayName] =
    useState('Owner');

  const [offlinePreview, setOfflinePreview] =
    useState(false);

  const [
    passwordRecovery,
    setPasswordRecovery,
  ] = useState(false);

  const [selectedTab, setSelectedTab] =
    useState<Tab>('Dashboard');

  const [floors, setFloors] =
    useState<Floor[]>([]);

  const [rooms, setRooms] =
    useState<Room[]>([]);

  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [bills, setBills] =
    useState<Bill[]>([]);

  /*
   * Reload all records from the local
   * SQLite database.
   */
  const reload = useCallback(
    async () => {
      try {
        const [
          floorRecords,
          roomRecords,
          tenantRecords,
          billRecords,
        ] = await Promise.all([
          listFloors(),
          listRooms(),
          listTenants(),
          listBills(),
        ]);

        setFloors(floorRecords);
        setRooms(roomRecords);
        setTenants(tenantRecords);
        setBills(billRecords);
      } catch (error) {
        console.error(
          'Data reload error:',
          error
        );
      }
    },
    []
  );

  /*
   * Open the SQLite database for the
   * logged-in user and synchronize data.
   */
  const openAccount = useCallback(
    async (userId: string) => {
      try {
        await initDb(userId);

        try {
          await syncPending();
        } catch (syncError) {
          console.error(
            'Synchronization error:',
            syncError
          );
        }

        await reload();

        setOfflinePreview(false);
        setLoggedIn(true);
      } catch (error) {
        console.error(
          'Account loading error:',
          error
        );
      }
    },
    [reload]
  );

  /*
   * Handle email confirmation and
   * password-reset links.
   */
  const handleAuthenticationUrl =
    useCallback(
      async (url: string | null) => {
        if (
          !url ||
          !supabase
        ) {
          return;
        }

        const parameterText =
          url.split('#')[1] ||
          url.split('?')[1] ||
          '';

        const parameters =
          new URLSearchParams(
            parameterText
          );

        const accessToken =
          parameters.get(
            'access_token'
          );

        const refreshToken =
          parameters.get(
            'refresh_token'
          );

        const authenticationType =
          parameters.get('type');

        if (
          accessToken &&
          refreshToken
        ) {
          const {
            error,
          } =
            await supabase.auth.setSession({
              access_token:
                accessToken,

              refresh_token:
                refreshToken,
            });

          if (error) {
            console.error(
              'Authentication link error:',
              error
            );

            return;
          }

          if (
            authenticationType ===
              'recovery' ||
            url.includes(
              'reset-password'
            )
          ) {
            setPasswordRecovery(true);
          }
        }
      },
      []
    );

  /*
   * Initialize authentication when
   * the application starts.
   */
  useEffect(() => {
    let active = true;

    async function initializeApp() {
      try {
        const initialUrl =
          await Linking.getInitialURL();

        await handleAuthenticationUrl(
          initialUrl
        );

        if (supabase) {
          const {
            data,
          } =
            await supabase.auth.getSession();

          if (
            data.session &&
            active
          ) {
            const name =
              data.session.user.user_metadata?.full_name ||
              data.session.user.email?.split('@')[0] ||
              'Owner';
            setDisplayName(String(name));
            await openAccount(
              data.session.user.id
            );
          }
        }
      } catch (error) {
        console.error(
          'Application initialization error:',
          error
        );
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }

    void initializeApp();

    const linkingSubscription =
      Linking.addEventListener(
        'url',
        ({ url }) => {
          void handleAuthenticationUrl(
            url
          );
        }
      );

    const authenticationSubscription =
      supabase?.auth.onAuthStateChange(
        (event, session) => {
          if (
            event ===
            'PASSWORD_RECOVERY'
          ) {
            setPasswordRecovery(true);
          }

          if (session) {
            const name =
              session.user.user_metadata?.full_name ||
              session.user.email?.split('@')[0] ||
              'Owner';
            setDisplayName(String(name));

            /*
             * Run account loading outside
             * the Supabase auth callback.
             */
            setTimeout(() => {
              void openAccount(
                session.user.id
              );
            }, 0);
          } else {
            setLoggedIn(false);
            setDisplayName('Owner');
          }
        }
      ).data.subscription;

    return () => {
      active = false;

      linkingSubscription.remove();

      authenticationSubscription?.unsubscribe();
    };
  }, [
    handleAuthenticationUrl,
    openAccount,
  ]);

  /*
   * Developer offline-preview account.
   */
  async function openOfflinePreview() {
    try {
      await initDb('preview');
      await reload();
      setOfflinePreview(true);
      setLoggedIn(true);
    } catch (error) {
      console.error(
        'Offline preview error:',
        error
      );
    }
  }

  const handleLogout = useCallback(
    async () => {
      try {
        if (
          supabase &&
          !offlinePreview
        ) {
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error(
          'Logout error:',
          error
        );
      } finally {
        setLoggedIn(false);
        setDisplayName('Owner');
        setOfflinePreview(false);
        setPasswordRecovery(false);
        setSelectedTab('Dashboard');

        setFloors([]);
        setRooms([]);
        setTenants([]);
        setBills([]);
      }
    },
    [offlinePreview]
  );

  /*
   * Initial application loading screen.
   */
  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text style={styles.loadingText}>
          Loading House Rent Manager...
        </Text>
      </View>
    );
  }

  /*
   * Authentication screen.
   */
  if (
    !loggedIn ||
    passwordRecovery
  ) {
    return (
      <AuthScreen
        key={
          passwordRecovery
            ? 'password-recovery'
            : 'authentication'
        }
        onOffline={
          openOfflinePreview
        }
        recovery={
          passwordRecovery
        }
        onRecoveryDone={() =>
          setPasswordRecovery(false)
        }
      />
    );
  }

  const applicationContent = (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar style="light" />

      {/* Application header */}

      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>
            House Rent Manager
          </Text>

          <Text
            style={
              styles.brandSubtitle
            }
          >
            Manage smarter · rent better
          </Text>
        </View>

        <View style={styles.localBadge}>
          <Text
            style={
              styles.localBadgeText
            }
          >
            ● Cloud + local
          </Text>
        </View>
      </View>

      {/* Application screens */}

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        {selectedTab ===
          'Dashboard' && (
          <DashboardScreen
            rooms={rooms}
            tenants={tenants}
            bills={bills}
            displayName={displayName}
            onNavigate={
              setSelectedTab
            }
          />
        )}

        {selectedTab ===
          'Properties' && (
          <PropertiesScreen
            floors={floors}
            rooms={rooms}
            reload={reload}
          />
        )}

        {selectedTab ===
          'Tenants' && (
          <TenantsScreen
            rooms={rooms}
            tenants={tenants}
            reload={reload}
          />
        )}

        {selectedTab ===
          'Bills' && (
          <BillsScreen
            tenants={tenants}
            bills={bills}
            reload={reload}
          />
        )}

        {selectedTab ===
          'Settings' && (
          <SettingsScreen
            onLogout={() => {
              void handleLogout();
            }}
            onSynced={reload}
          />
        )}
      </ScrollView>

      {/* Bottom navigation */}

      <View style={styles.navigation}>
        {tabs.map((tab) => {
          const isActive =
            selectedTab === tab;

          return (
            <Pressable
              key={tab}
              onPress={() =>
                setSelectedTab(tab)
              }
              style={[
                styles.navigationItem,

                isActive &&
                  styles.activeNavigationItem,
              ]}
            >
              <Text
                style={[
                  styles.navigationIcon,

                  isActive &&
                    styles.activeNavigationText,
                ]}
              >
                {tabIcons[tab]}
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.navigationText,

                  isActive &&
                    styles.activeNavigationText,
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );

  if (offlinePreview) {
    return applicationContent;
  }

  return (
    <BiometricLock
      onUsePassword={handleLogout}
    >
      {applicationContent}
    </BiometricLock>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    color: colors.muted,
    marginTop: 12,
    fontWeight: '800',
  },
  topBar: {
    minHeight: 58,
    backgroundColor: '#075E54',
    borderBottomWidth: 1,
    borderBottomColor: '#0A5149',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? (NativeStatusBar.currentHeight ?? 0) + 7 : 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F2D26',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  brand: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.25,
  },
  brandSubtitle: {
    fontSize: 9,
    color: '#CDE9E1',
    marginTop: 3,
  },
  localBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  localBadgeText: {
    fontSize: 8.5,
    color: '#DDF8EE',
    fontWeight: '900',
  },
  content: {
    padding: 12,
    paddingTop: 13,
    paddingBottom: 34,
  },
  navigation: {
    minHeight: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 4,
    shadowColor: '#0F2D26',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  navigationItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  activeNavigationItem: {
    backgroundColor: colors.accent,
  },
  navigationIcon: {
    fontSize: 16,
    color: '#8A9A94',
    marginBottom: 3,
  },
  navigationText: {
    fontSize: 8.5,
    color: '#7A8A84',
    fontWeight: '700',
  },
  activeNavigationText: {
    color: colors.primary,
    fontWeight: '900',
  },
});

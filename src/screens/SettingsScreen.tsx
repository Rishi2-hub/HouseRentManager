import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Button,
  Card,
  Input,
  Label,
} from '../components/UI';

import {
  cloudConfigured,
  supabase,
} from '../lib/supabase';

import {
  syncPending,
} from '../services/sync';

import {
  colors,
} from '../theme';

type HouseholdMember = {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

type HouseholdInfo = {
  household_id?: string | null;
  invite_code?: string | null;
  member_count?: number | null;
  current_role?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  members?: HouseholdMember[] | null;
};

const validPassword = (value: string) =>
  value.length >= 8;

export function SettingsScreen({
  onLogout,
  onSynced,
}: {
  onLogout: () => void;
  onSynced: () => void;
}) {
  const [msg, setMsg] = useState(
    cloudConfigured
      ? 'Cloud configured'
      : 'Cloud setup required'
  );

  const [household, setHousehold] =
    useState<HouseholdInfo | null>(null);

  const [signedInName, setSignedInName] =
    useState('');

  const [signedInEmail, setSignedInEmail] =
    useState('');

  const [joinCode, setJoinCode] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [changingPassword, setChangingPassword] =
    useState(false);

  const [joining, setJoining] =
    useState(false);

  const members =
    household?.members ?? [];

  const memberCount =
    Number(household?.member_count ?? members.length ?? 0);

  const householdFull =
    memberCount >= 2;

  const inviteCode =
    household?.invite_code ?? '';

  const currentRole =
    (household?.current_role ?? '').toLowerCase();

  const isOwner =
    currentRole === 'owner';

  const memberSummary = useMemo(() => {
    if (members.length > 0) {
      return members;
    }

    return [];
  }, [members]);

  async function load() {
    if (!supabase) {
      return;
    }

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (!userError && userData.user) {
      const metadata =
        userData.user.user_metadata ?? {};

      setSignedInName(
        String(metadata.full_name ?? '')
      );

      setSignedInEmail(
        userData.user.email ?? ''
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc('my_household');

    if (error) {
      setMsg(error.message);
      return;
    }

    if (data?.[0]) {
      const row = data[0] as HouseholdInfo;

      let parsedMembers: HouseholdMember[] = [];

      if (Array.isArray(row.members)) {
        parsedMembers = row.members;
      } else if (
        typeof row.members === 'string'
      ) {
        try {
          const parsed =
            JSON.parse(row.members);

          if (Array.isArray(parsed)) {
            parsedMembers = parsed;
          }
        } catch {
          parsedMembers = [];
        }
      }

      setHousehold({
        ...row,
        members: parsedMembers,
      });
    } else {
      setHousehold(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function sync() {
    const result =
      await syncPending();

    setMsg(result.message);

    onSynced();

    Alert.alert(
      'Synchronization',
      result.message
    );
  }

  async function join() {
    if (!supabase) {
      return;
    }

    const code =
      joinCode.replace(/\D/g, '');

    if (code.length !== 6) {
      Alert.alert(
        '6-digit code required',
        'Enter the 6-digit household sharing code from the owner.'
      );
      return;
    }

    setJoining(true);

    try {
      const {
        error,
      } = await supabase.rpc(
        'join_household',
        {
          share_code: code,
        }
      );

      if (error) {
        Alert.alert(
          'Could not join',
          error.message
        );
        return;
      }

      setJoinCode('');

      Alert.alert(
        'Household joined',
        'You now share the same household records with the owner.'
      );

      await load();

      const result =
        await syncPending();

      setMsg(result.message);
      onSynced();
    } finally {
      setJoining(false);
    }
  }

  async function changePassword() {
    if (!supabase) {
      Alert.alert(
        'Cloud not configured',
        'Supabase must be configured before changing the password.'
      );
      return;
    }

    if (!validPassword(newPassword)) {
      Alert.alert(
        'Weak password',
        'Use at least 8 characters.'
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      Alert.alert(
        'Passwords do not match',
        'Enter the same password in both fields.'
      );
      return;
    }

    setChangingPassword(true);

    try {
      const {
        error,
      } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        Alert.alert(
          'Password update failed',
          error.message
        );
        return;
      }

      setNewPassword('');
      setConfirmPassword('');

      Alert.alert(
        'Password changed',
        'Your account password has been updated successfully.'
      );
    } finally {
      setChangingPassword(false);
    }
  }

  async function logout() {
    await supabase?.auth.signOut();
    onLogout();
  }

  return (
    <>
      <Text style={s.h}>
        Settings
      </Text>

      <Card>
        <Text style={s.title}>
          Signed-in account
        </Text>

        <Text style={s.infoLabel}>
          Name
        </Text>
        <Text style={s.infoValue}>
          {signedInName || 'Not provided'}
        </Text>

        <Text style={s.infoLabel}>
          Email
        </Text>
        <Text style={s.infoValue}>
          {signedInEmail || 'Not available'}
        </Text>

        <Text style={s.infoLabel}>
          Role
        </Text>
        <Text style={s.infoValue}>
          {currentRole
            ? currentRole.toUpperCase()
            : 'MEMBER'}
        </Text>
      </Card>

      <Card>
        <Text style={s.title}>
          Owner details
        </Text>

        <Text style={s.infoLabel}>
          Household owner
        </Text>
        <Text style={s.infoValue}>
          {household?.owner_name ||
            'Connect to load owner'}
        </Text>

        <Text style={s.infoLabel}>
          Owner email
        </Text>
        <Text style={s.infoValue}>
          {household?.owner_email ||
            'Not available'}
        </Text>

        <Text style={s.infoLabel}>
          Household ID
        </Text>
        <Text style={s.smallValue}>
          {household?.household_id ||
            'Not loaded'}
        </Text>
      </Card>

      <Card>
        <Text style={s.title}>
          Shared household
        </Text>

        <View style={s.memberHeader}>
          <Text style={s.p}>
            Members
          </Text>
          <Text
            style={[
              s.memberCount,
              householdFull &&
                s.memberCountFull,
            ]}
          >
            {memberCount}/2
          </Text>
        </View>

        {isOwner ? (
          <>
            <Text style={s.p}>
              Share this 6-digit number with
              one trusted person. Only one
              additional account can join.
            </Text>

            <Text style={s.code}>
              {inviteCode ||
                '------'}
            </Text>
          </>
        ) : (
          <Text style={s.p}>
            You are using a household shared
            by the owner.
          </Text>
        )}

        {memberSummary.length > 0 && (
          <View style={s.memberList}>
            {memberSummary.map(
              (member, index) => (
                <View
                  key={
                    member.user_id ||
                    String(index)
                  }
                  style={s.memberRow}
                >
                  <View style={s.memberNumber}>
                    <Text style={s.memberNumberText}>
                      {index + 1}
                    </Text>
                  </View>

                  <View style={s.memberText}>
                    <Text style={s.memberName}>
                      {member.full_name ||
                        member.email ||
                        'Household member'}
                    </Text>
                    <Text style={s.memberMeta}>
                      {(member.role ||
                        (index === 0
                          ? 'owner'
                          : 'member')
                      ).toUpperCase()}
                      {member.email
                        ? ` • ${member.email}`
                        : ''}
                    </Text>
                  </View>
                </View>
              )
            )}
          </View>
        )}

        {!householdFull && (
          <>
            <Label>
              Join another household
            </Label>

            <Input
              keyboardType="number-pad"
              value={joinCode}
              onChangeText={(value) =>
                setJoinCode(
                  value
                    .replace(/\D/g, '')
                    .slice(0, 6)
                )
              }
              placeholder="Enter 6-digit code"
              maxLength={6}
            />

            <Button
              disabled={joining}
              title={
                joining
                  ? 'Joining…'
                  : 'Join household'
              }
              kind="secondary"
              onPress={join}
            />
          </>
        )}

        {householdFull && (
          <Text style={s.fullMessage}>
            This household is full. Maximum:
            1 owner + 1 shared member.
          </Text>
        )}
      </Card>

      <Card>
        <Text style={s.title}>
          Change password
        </Text>

        <Text style={s.p}>
          Change the password for your own
          account. The other household member
          keeps their separate password.
        </Text>

        <Label>
          New password
        </Label>

        <Input
          secureTextEntry={!showPassword}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Minimum 8 characters"
        />

        <Label>
          Confirm new password
        </Label>

        <Input
          secureTextEntry={!showPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Enter it again"
        />

        <Pressable
          onPress={() =>
            setShowPassword(
              (value) => !value
            )
          }
          style={s.showPassword}
        >
          <Text style={s.showPasswordText}>
            {showPassword
              ? '◉ Hide password'
              : '○ Show password'}
          </Text>
        </Pressable>

        <Button
          disabled={changingPassword}
          title={
            changingPassword
              ? 'Updating…'
              : 'Change password'
          }
          onPress={changePassword}
        />
      </Card>

      <Card>
        <Text style={s.title}>
          Cloud & offline storage
        </Text>

        <Text style={s.p}>
          {msg}
        </Text>

        <Text style={s.p}>
          Records are stored locally first
          and synchronized with the shared
          household when internet returns.
        </Text>

        <Button
          title="Sync now"
          onPress={sync}
        />
      </Card>

      <Card>
        <Text style={s.title}>
          Account security
        </Text>

        <Text style={s.p}>
          Every member has a separate user ID,
          verified email and password. Sharing
          a household never shares a password.
        </Text>

        <Button
          title="Log out"
          kind="danger"
          onPress={logout}
        />
      </Card>
    </>
  );
}

const s = StyleSheet.create({
  h: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 16,
  },

  title: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 12,
  },

  p: {
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 12,
  },

  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },

  infoValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },

  smallValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },

  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  memberCount: {
    color: colors.primary,
    fontWeight: '900',
    marginBottom: 12,
  },

  memberCountFull: {
    color: '#B45309',
  },

  code: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 6,
    color: colors.primary,
    textAlign: 'center',
    padding: 14,
    backgroundColor: colors.accent,
    borderRadius: 12,
    marginBottom: 16,
  },

  memberList: {
    marginBottom: 10,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  memberNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  memberNumberText: {
    color: colors.primary,
    fontWeight: '900',
  },

  memberText: {
    flex: 1,
  },

  memberName: {
    color: colors.text,
    fontWeight: '800',
  },

  memberMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },

  fullMessage: {
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
    fontWeight: '800',
    lineHeight: 19,
  },

  showPassword: {
    alignSelf: 'flex-end',
    marginTop: -5,
    marginBottom: 12,
    paddingVertical: 5,
  },

  showPasswordText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});

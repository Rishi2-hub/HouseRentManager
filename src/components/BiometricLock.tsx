import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as LocalAuthentication from 'expo-local-authentication';

type BiometricLockProps = {
  children: ReactNode;
  onUsePassword: () => Promise<void> | void;
};

export function BiometricLock({
  children,
  onUsePassword,
}: BiometricLockProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(true);
  const [methodName, setMethodName] = useState(
    'Fingerprint or Face ID',
  );
  const [message, setMessage] = useState(
    'Verify your identity to continue.',
  );

  const authenticating = useRef(false);

  const authenticate = useCallback(async () => {
    if (authenticating.current) {
      return;
    }

    authenticating.current = true;
    setChecking(true);

    try {
      const hasHardware =
        await LocalAuthentication.hasHardwareAsync();

      const enrolled =
        await LocalAuthentication.isEnrolledAsync();

      const supportedTypes =
        await LocalAuthentication.supportedAuthenticationTypesAsync();

      const hasFace = supportedTypes.includes(
        LocalAuthentication.AuthenticationType
          .FACIAL_RECOGNITION,
      );

      const hasFingerprint = supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      );

      if (hasFace && hasFingerprint) {
        setMethodName('Fingerprint or Face ID');
      } else if (hasFace) {
        setMethodName('Face ID');
      } else if (hasFingerprint) {
        setMethodName('Fingerprint');
      } else {
        setMethodName('Biometric login');
      }

      if (!hasHardware) {
        setAvailable(false);
        setMessage(
          'Biometric authentication is not supported on this phone.',
        );
        return;
      }

      if (!enrolled) {
        setAvailable(false);
        setMessage(
          'No fingerprint or face is registered. Add one in Android Settings first.',
        );
        return;
      }

      setAvailable(true);
      setMessage('Verify your identity to continue.');

      const result =
        await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock House Rent Manager',
          promptDescription:
            'Use your fingerprint or face to continue.',
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use password',
          disableDeviceFallback: true,
        });

      if (result.success) {
        setUnlocked(true);
        setMessage('');
      } else {
        setUnlocked(false);

        if (result.error === 'user_cancel') {
          setMessage(
            'Authentication was cancelled. Tap below to try again.',
          );
        } else if (result.error === 'lockout') {
          setMessage(
            'Biometric authentication is temporarily locked. Use your email and password.',
          );
        } else {
          setMessage(
            'Fingerprint or face was not recognized. Please try again.',
          );
        }
      }
    } catch (error) {
      console.error(
        'Biometric authentication error:',
        error,
      );

      setUnlocked(false);
      setMessage(
        'Biometric authentication could not start. Use email and password.',
      );
    } finally {
      authenticating.current = false;
      setChecking(false);
    }
  }, []);

  /*
   * Authenticate only when the biometric page
   * is first opened. Opening the camera, gallery,
   * document picker or another app will not lock it.
   */
  useEffect(() => {
    void authenticate();
  }, [authenticate]);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>HR</Text>
        </View>

        <Text style={styles.title}>
          House Rent Manager
        </Text>

        <Text style={styles.subtitle}>
          Secure owner access
        </Text>

        <View style={styles.biometricCircle}>
          <Text style={styles.biometricIcon}>◎</Text>
        </View>

        <Text style={styles.method}>
          {methodName}
        </Text>

        <Text style={styles.message}>
          {message}
        </Text>

        {checking ? (
          <ActivityIndicator
            size="large"
            color="#075E54"
          />
        ) : (
          <>
            {available && (
              <Pressable
                style={styles.unlockButton}
                onPress={() => {
                  void authenticate();
                }}
              >
                <Text style={styles.unlockButtonText}>
                  Unlock with {methodName}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={styles.passwordButton}
              onPress={() => {
                void onUsePassword();
              }}
            >
              <Text style={styles.passwordButtonText}>
                Use email and password
              </Text>
            </Pressable>
          </>
        )}

        <Text style={styles.securityNote}>
          Your email password is never stored for biometric login.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  logo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#075E54',
    marginBottom: 20,
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },

  title: {
    color: '#102521',
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: '#6D7C78',
    fontSize: 14,
    marginTop: 6,
  },

  biometricCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFF2EC',
    borderColor: '#8BCAB8',
    borderWidth: 2,
    marginTop: 40,
    marginBottom: 18,
  },

  biometricIcon: {
    color: '#075E54',
    fontSize: 72,
    lineHeight: 78,
  },

  method: {
    color: '#102521',
    fontSize: 18,
    fontWeight: '800',
  },

  message: {
    minHeight: 50,
    color: '#6D7C78',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },

  unlockButton: {
    width: '100%',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#075E54',
    paddingHorizontal: 14,
  },

  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },

  passwordButton: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#B7C8C3',
    borderWidth: 1,
    marginTop: 12,
  },

  passwordButtonText: {
    color: '#075E54',
    fontSize: 14,
    fontWeight: '800',
  },

  securityNote: {
    color: '#81908C',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
  },
});
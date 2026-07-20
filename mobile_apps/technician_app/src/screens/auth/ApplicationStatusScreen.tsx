import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, MailCheck } from 'lucide-react-native';
import { BRAND } from '../../config/brand';

type ApplicationStatus = 'verify_email' | 'email_verified' | 'under_review';

interface ApplicationStatusScreenProps {
  email?: string;
  status: ApplicationStatus;
  verificationEmailSent?: boolean;
  onBackToLogin: () => void;
}

const Colors = {
  background: '#0B0B0D',
  surface: '#17171A',
  border: '#303036',
  primary: '#B8FF3D',
  text: '#F7F7F5',
  textMuted: '#B9B9BF',
};

export function ApplicationStatusScreen({
  email,
  status,
  verificationEmailSent,
  onBackToLogin,
}: ApplicationStatusScreenProps): React.JSX.Element {
  const isVerified = status === 'email_verified';
  const Icon = isVerified ? MailCheck : Clock;
  const title = isVerified ? 'Email verified' : 'Application submitted';
  const message = isVerified
    ? 'Your email is verified. Your technician application still needs approval before you can access the dashboard.'
    : verificationEmailSent === false
      ? 'Your application is under review, but we could not send the verification email. Please contact support if it does not arrive.'
      : `We sent a verification link${email ? ` to ${email}` : ''}. Please verify your email while our team reviews your application.`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Icon color={Colors.primary} size={34} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{message}</Text>
        <View style={styles.reviewBox}>
          <Text style={styles.reviewTitle}>What happens next</Text>
          <Text style={styles.reviewText}>1. Verify your email.</Text>
          <Text style={styles.reviewText}>2. {BRAND.displayName} reviews your technician profile.</Text>
          <Text style={styles.reviewText}>3. Once approved, sign in to start receiving jobs.</Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={onBackToLogin}>
          <Text style={styles.primaryButtonText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: Colors.text, fontSize: 25, fontWeight: '900' },
  body: { color: Colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 20 },
  reviewBox: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16, marginBottom: 24 },
  reviewTitle: { color: Colors.text, fontSize: 14, fontWeight: '900', marginBottom: 10 },
  reviewText: { color: Colors.textMuted, fontSize: 13, lineHeight: 22, fontWeight: '600' },
  primaryButton: { height: 52, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: Colors.background, fontSize: 15, fontWeight: '900' },
});

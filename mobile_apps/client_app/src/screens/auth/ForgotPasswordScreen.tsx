// mobile_apps/client_app/src/screens/auth/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  ActivityIndicator,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ForgotPasswordScreen({ navigation }: any): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleResetRequest = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    
    setIsLoading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.3.3:5000/api/v1';
      const response = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Unable to handle recovery request.');
      }

      Alert.alert(
        'Reset Link Sent', 
        'If an account exists with that email, a recovery link has been dispatched.',
        [{ text: 'Back to Login', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: any) {
      Alert.alert('Request Failed', error.message || 'Network transport failure.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.headerBlock}>
            <Text style={styles.titleText}>Account Recovery</Text>
            <Text style={styles.subtitleText}>Enter your email to receive a secure recovery link.</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput 
                style={styles.inputField}
                placeholder="name@domain.com"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleResetRequest} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#090D14" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Reset Link ✓</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Login')} disabled={isLoading}>
              <Text style={styles.backButtonText}>← Back to Sign In</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  headerBlock: { marginBottom: 32 },
  titleText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitleText: { color: '#64748B', fontSize: 14, marginTop: 6, fontWeight: '500' },
  formContainer: { width: '100%' },
  inputGroup: { width: '100%', marginBottom: 16 },
  inputLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  inputField: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 16, color: '#FFFFFF', fontSize: 15 },
  primaryButton: { backgroundColor: '#00FF87', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#090D14', fontSize: 15, fontWeight: '700' },
  backButton: { alignItems: 'center', marginTop: 24, paddingVertical: 8 },
  backButtonText: { color: '#64748B', fontSize: 14, fontWeight: '600' }
});
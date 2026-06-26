// mobile_apps/client_app/src/screens/auth/LoginScreen.tsx
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

export function LoginScreen({ navigation }: any): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    // Clean and validate variables safely
    const targetEmail = email ? email.trim() : '';
    const targetPassword = password ? password : '';

    if (!targetEmail || !targetPassword) {
      Alert.alert("Authentication Failed", "Please populate all fields.");
      return;
    }
    
    setIsLoading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.3.34:5000/api/v1';
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail.toLowerCase(),
          password: targetPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Invalid username or credentials.');
      }

      // ✅ CHANGED: Redirect directly to Dashboard on successful authentication
      navigation?.replace('MainTabs');
    } catch (error: any) {
      Alert.alert('Access Denied', error.message || 'Network transport failure. Check host connection rules.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.brandContainer}>
            <Text style={styles.logoText}>MyFixer <Text style={styles.proAccent}>Pro</Text></Text>
            <Text style={styles.tagline}>On-Demand Verified Field Specialists</Text>
          </View>

          <View style={styles.formContainer}>
            {/* Email Layer */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput 
                style={styles.input}
                placeholder="name@domain.com"
                placeholderTextColor="#64748B"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="username"
                value={email}
                onChangeText={setEmail}
                onChange={(e) => setEmail(e.nativeEvent.text)} // ✅ FIX: Catches Autofill
                editable={!isLoading}
              />
            </View>

            {/* Password Layer */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Secure Password</Text>
              <TextInput 
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor="#64748B"
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                onChange={(e) => setPassword(e.nativeEvent.text)} // ✅ FIX: Catches Autofill
                editable={!isLoading}
              />
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity 
              style={styles.forgotBtn} 
              activeOpacity={0.7} 
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={isLoading}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginBtn} activeOpacity={0.8} onPress={handleLogin} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#090D14" />
              ) : (
                <Text style={styles.loginBtnText}>Secure Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to the platform? </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Register')} disabled={isLoading}>
              <Text style={styles.registerText}>Create Account</Text>
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
  brandContainer: { alignItems: 'center', marginBottom: 40 },
  logoText: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  proAccent: { color: '#00FF87' },
  tagline: { color: '#64748B', fontSize: 14, marginTop: 6, fontWeight: '500' },
  formContainer: { width: '100%' },
  inputGroup: { width: '100%', marginBottom: 16 },
  inputLabel: { color: '#E2E8F0', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#111827', color: '#FFFFFF', padding: 15, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#1E293B' },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 8 }, 
  forgotText: { color: '#64748B', fontSize: 13, fontWeight: '500' },
  loginBtn: { backgroundColor: '#00FF87', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  loginBtnText: { color: '#090D14', fontSize: 15, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  footerText: { color: '#64748B', fontSize: 14 },
  registerText: { color: '#00FF87', fontSize: 14, fontWeight: '600' }
});
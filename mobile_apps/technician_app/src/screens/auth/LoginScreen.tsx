// src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import apiService from '../../services/api.service';
import authService, { AuthSession } from '../../services/auth.service';

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
  onRegisterPress: () => void;
}

export function LoginScreen({ onLoginSuccess, onRegisterPress }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your technician email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const session = await apiService.login(email, password);
      const role = session.user.role.toUpperCase();

      if (role !== 'TECHNICIAN' && role !== 'ADMIN') {
        throw new Error('This account is not registered as a technician.');
      }

      authService.setSession(session);
      onLoginSuccess(session);
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Unable to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.innerContainer}
      >
        
        {/* 1. Brand Logo & Header Segment */}
        <View style={styles.headerContainer}>
          <Image 
            source={{ uri: 'https://res.cloudinary.com/dz7dr3wku/image/upload/v1782316410/favicon-96x96_ymy1mu.png' }} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>MyFixer<Text style={styles.accentText}> Pro</Text></Text>
          <Text style={styles.subtitleText}>Technician Portal</Text>
        </View>

        {/* 2. Authentication Input Matrix */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput 
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#64748B" // Slate gray placeholder
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput 
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#64748B"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!isLoading}
          />
        </View>

        {/* 3. Operational Sign In Button Trigger */}
        <TouchableOpacity 
          style={styles.loginButton} 
          activeOpacity={0.8} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#090D14" />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerLink} onPress={onRegisterPress} disabled={isLoading}>
          <Text style={styles.registerText}>New provider? Apply to join MyFixer Pro</Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#090D14' // Synchronized Matte Black Theme
  },
  innerContainer: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'center' 
  },
  headerContainer: { 
    alignItems: 'center', 
    marginBottom: 40 
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  logoText: { 
    fontSize: 32, 
    fontWeight: '700', 
    color: '#FFFFFF' 
  },
  accentText: { 
    color: '#00FF87' // Electric MyFixer Accent Green
  }, 
  subtitleText: { 
    fontSize: 14, 
    color: '#64748B', 
    marginTop: 6,
    fontWeight: '500'
  },
  formContainer: { 
    marginBottom: 24 
  },
  inputLabel: { 
    color: '#FFFFFF', 
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 8 
  },
  input: { 
    backgroundColor: '#111827', // Deep slate container background fill
    color: '#FFFFFF', 
    padding: 16, 
    borderRadius: 12, 
    fontSize: 16, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B' // Clean structural borders
  },
  loginButton: { 
    backgroundColor: '#00FF87', // Electric Accent Green
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: '#00FF87',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  loginButtonText: { 
    color: '#090D14', // High-contrast text core execution 
    fontSize: 16, 
    fontWeight: '700' 
  },
  registerLink: { alignItems: 'center', paddingVertical: 18 },
  registerText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' }
});

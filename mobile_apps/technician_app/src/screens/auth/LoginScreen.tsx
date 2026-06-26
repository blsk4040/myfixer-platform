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
  Image 
} from 'react-native';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.innerContainer}
      >
        
        {/* 1. Brand Logo & Header Segment */}
        <View style={styles.headerContainer}>
          <Image 
            source={{ uri: 'https://res.cloudinary.com/dz7dr3wku/image/upload/v1782316410/favicon-96x96_ymy1mu.png' }} // 👈 Point this to your asset destination file
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
          />
        </View>

        {/* 3. Operational Sign In Button Trigger */}
        <TouchableOpacity 
          style={styles.loginButton} 
          activeOpacity={0.8} 
          onPress={onLoginSuccess}
        >
          <Text style={styles.loginButtonText}>Sign In</Text>
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
  }
});
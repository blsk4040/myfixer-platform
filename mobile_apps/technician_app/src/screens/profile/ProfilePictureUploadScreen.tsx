// src/screens/profile/ProfilePictureUploadScreen.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  ScrollView // 👈 FIXED: Pulled natively from standard react-native layout group
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ProfilePictureUploadScreen({ navigation }: any): React.JSX.Element {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);

  // Simulating the AI Biometric Vision Shield payload we discussed
  const handlePhotoSelectionSimulated = () => {
    setIsAnalyzing(true);

    setTimeout(() => {
      setIsAnalyzing(false);
      setHasPhoto(true);
      
      Alert.alert(
        "🛡️ AI Security Cleared",
        "Biometric scan complete. Exactly one clear, high-resolution face detected. Masking, lighting, and fraud-checks passed.",
        [{ text: "Excellent" }]
      );
    }, 2200);
  };

  const handleSaveVerifiedPhoto = () => {
    Alert.alert(
      "Profile Identity Updated",
      "Your face token is securely saved. Clients will be prompted to visually audit this exact headshot upon your physical arrival.",
      [{ text: "Done", onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Biometric Verification Photo</Text>
        <Text style={styles.subtitle}>
          For mutual trust and security, clients must verify your identity before allowing entry to their homes or business properties.
        </Text>

        {/* Dynamic Image Canvas Box */}
        <View style={styles.photoCanvasFrame}>
          {isAnalyzing ? (
            <View style={styles.statusBox}>
              <ActivityIndicator size="large" color="#00FF87" />
              <Text style={styles.statusText}>Analyzing Face Token with AI Vision...</Text>
            </View>
          ) : hasPhoto ? (
            <View style={styles.imageContainer}>
              <View style={styles.avatarPlaceholderFilled}>
                <Text style={styles.avatarTxtMed}>AM</Text>
              </View>
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>✓ BIOMETRICS PASSED</Text>
              </View>
            </View>
          ) : (
            <View style={styles.statusBox}>
              <Text style={styles.emptyText}>No Verified Photo Stored</Text>
              <Text style={styles.subEmptyText}>Must be a clean, clear headshot of just you.</Text>
            </View>
          )}
        </View>

        {/* Rules & Requirements Alert Card */}
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ Global Safety Rules:</Text>
          <Text style={styles.warningBullet}>• Photo MUST contain your real face exclusively.</Text>
          <Text style={styles.warningBullet}>• Group images, landscape photos, or cartoon avatars are immediately flagged by the system.</Text>
          <Text style={styles.warningBullet}>• Clients have the authority to halt the assignment and report an account mismatch if someone else arrives.</Text>
        </View>

        {/* Actions Button Matrix */}
        <TouchableOpacity 
          style={styles.actionButtonSecondary} 
          onPress={handlePhotoSelectionSimulated}
          disabled={isAnalyzing}
        >
          <Text style={styles.actionButtonSecondaryText}>
            {hasPhoto ? "Retake / Upload New Photo" : "Select Headshot From Device"}
          </Text>
        </TouchableOpacity>

        {hasPhoto && (
          <TouchableOpacity style={styles.actionButtonPrimary} onPress={handleSaveVerifiedPhoto}>
            <Text style={styles.actionButtonPrimaryText}>Deploy to Dispatch Identity Network</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ⚠️ FIXED: Removed the out-of-order gesture handler import from the bottom here.

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20, alignItems: 'center' },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 6, alignSelf: 'flex-start' },
  subtitle: { color: '#64748B', fontSize: 13, lineHeight: 18, marginBottom: 25, alignSelf: 'flex-start' },
  photoCanvasFrame: { width: '100%', height: 260, backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 20 },
  statusBox: { alignItems: 'center', padding: 20 },
  statusText: { color: '#00FF87', fontSize: 13, fontWeight: '600', marginTop: 12 },
  emptyText: { color: '#E2E8F0', fontSize: 15, fontWeight: '600' },
  subEmptyText: { color: '#64748B', fontSize: 12, marginTop: 4, textAlign: 'center' },
  imageContainer: { alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderFilled: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#00FF87' },
  avatarTxtMed: { color: '#00FF87', fontSize: 36, fontWeight: '700' },
  successBadge: { backgroundColor: '#00FF8715', borderWidth: 1, borderColor: '#00FF8740', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 16 },
  successBadgeText: { color: '#00FF87', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  warningCard: { backgroundColor: '#EF444408', borderWidth: 1, borderColor: '#EF444420', padding: 16, borderRadius: 12, width: '100%', marginBottom: 30 },
  warningTitle: { color: '#EF4444', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  warningBullet: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  actionButtonPrimary: { backgroundColor: '#00FF87', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  actionButtonPrimaryText: { color: '#090D14', fontSize: 14, fontWeight: '700' },
  actionButtonSecondary: { backgroundColor: '#111827', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B', marginTop: 10 },
  actionButtonSecondaryText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' }
});
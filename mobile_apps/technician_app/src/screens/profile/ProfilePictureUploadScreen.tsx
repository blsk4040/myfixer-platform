import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, ShieldCheck } from 'lucide-react-native';
import apiService from '../../services/api.service';
import { getTechnicianIdentity } from '../../services/technicianIdentity.service';
import { BRAND } from '../../config/brand';

const CameraIcon = Camera as any;
const ImageIconView = ImageIcon as any;
const ShieldCheckIcon = ShieldCheck as any;

const Colors = {
  background: '#0B0B0D',
  surface: '#17171A',
  surfaceRaised: '#222226',
  border: '#303036',
  primary: '#B8FF3D',
  text: '#F7F7F5',
  textMuted: '#B9B9BF',
  textSubtle: '#74747C',
};

const Radius = {
  md: 12,
  lg: 16,
};

const toDataUri = (asset: ImagePicker.ImagePickerAsset): string | null => {
  if (!asset.base64) return null;
  return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
};

export function ProfilePictureUploadScreen({ navigation }: any): React.JSX.Element {
  const technicianIdentity = getTechnicianIdentity();
  const [previewUri, setPreviewUri] = useState(technicianIdentity.profilePhotoUrl);
  const [dataUri, setDataUri] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const pickProfilePhoto = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow photo access to update your profile image.');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.75, base64: true, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75, base64: true, allowsEditing: true, aspect: [1, 1] });

    if (result.canceled || !result.assets?.[0]) return;

    const nextDataUri = toDataUri(result.assets[0]);
    if (!nextDataUri) {
      Alert.alert('Image Error', 'Could not prepare this photo for upload. Please try another image.');
      return;
    }

    setPreviewUri(result.assets[0].uri);
    setDataUri(nextDataUri);
  };

  const uploadPhoto = async () => {
    if (!dataUri) {
      Alert.alert('Photo Required', 'Please choose a new profile photo first.');
      return;
    }

    try {
      setIsUploading(true);
      await apiService.uploadTechnicianProfilePhoto({ dataUri });
      Alert.alert(
        'Photo Sent for Review',
        'Your new profile photo has been uploaded. Admin must approve it before it is shown to customers.',
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Upload Failed', error instanceof Error ? error.message : 'Unable to upload profile photo.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Profile Photo</Text>
        <Text style={styles.subtitle}>
          Upload a clear headshot. This image is reviewed by {BRAND.displayName} before customers see it.
        </Text>

        <View style={styles.photoCanvasFrame}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.profileImage} />
          ) : (
            <View style={styles.statusBox}>
              <CameraIcon color={Colors.textSubtle} size={42} />
              <Text style={styles.emptyText}>No profile photo uploaded</Text>
              <Text style={styles.subEmptyText}>Use a clear front-facing photo of only you.</Text>
            </View>
          )}
        </View>

        <View style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <ShieldCheckIcon color={Colors.primary} size={18} />
            <Text style={styles.warningTitle}>Admin review required</Text>
          </View>
          <Text style={styles.warningBullet}>Photo must show your real face clearly.</Text>
          <Text style={styles.warningBullet}>No group images, logos, masks, cartoons, or blurry photos.</Text>
          <Text style={styles.warningBullet}>Rejected photos must be replaced before your profile can be approved.</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButtonSecondary} onPress={() => pickProfilePhoto('camera')} disabled={isUploading}>
            <CameraIcon color={Colors.text} size={18} />
            <Text style={styles.actionButtonSecondaryText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonSecondary} onPress={() => pickProfilePhoto('library')} disabled={isUploading}>
            <ImageIconView color={Colors.text} size={18} />
            <Text style={styles.actionButtonSecondaryText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.actionButtonPrimary, (!dataUri || isUploading) && styles.disabledButton]} onPress={uploadPhoto} disabled={!dataUri || isUploading}>
          {isUploading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.actionButtonPrimaryText}>Submit Photo for Review</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContainer: { padding: 20 },
  title: { color: Colors.text, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  subtitle: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 22 },
  photoCanvasFrame: { width: '100%', aspectRatio: 1, backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 18 },
  profileImage: { width: '100%', height: '100%' },
  statusBox: { alignItems: 'center', padding: 22 },
  emptyText: { color: Colors.text, fontSize: 15, fontWeight: '800', marginTop: 12 },
  subEmptyText: { color: Colors.textSubtle, fontSize: 12, marginTop: 5, textAlign: 'center' },
  warningCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, padding: 16, borderRadius: Radius.md, width: '100%', marginBottom: 18 },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  warningTitle: { color: Colors.text, fontSize: 13, fontWeight: '900' },
  warningBullet: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButtonPrimary: { backgroundColor: Colors.primary, width: '100%', padding: 16, borderRadius: Radius.md, alignItems: 'center', marginTop: 12 },
  actionButtonPrimaryText: { color: Colors.background, fontSize: 14, fontWeight: '900' },
  actionButtonSecondary: { flex: 1, backgroundColor: Colors.surface, padding: 15, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', gap: 8 },
  actionButtonSecondaryText: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.5 },
});

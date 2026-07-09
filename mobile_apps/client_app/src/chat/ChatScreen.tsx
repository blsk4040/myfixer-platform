// src/screens/chat/ChatScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Send } from 'lucide-react-native';
import socketService from '../services/socket.service';
import apiService, { BookingChatMessage, JobMediaRecord } from '../services/api.service';

const CameraIcon = Camera as any;
const ImageIconView = ImageIcon as any;
const SendIcon = Send as any;

type ChatMessage = BookingChatMessage;

const formatTime = (value: string): string =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const toDataUri = (asset: ImagePicker.ImagePickerAsset): string | null => {
  if (!asset.base64) return null;
  return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
};

export function ChatScreen({ route }: any): React.JSX.Element {
  const { bookingId, jobId, techName = 'Assigned technician' } = route?.params || {};
  const chatId = bookingId ?? jobId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);

  const socketRef = useRef<ReturnType<typeof socketService.initializeConnection> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message];
    });
  };

  useEffect(() => {
    if (!chatId) {
      setIsLoading(false);
      return undefined;
    }

    apiService.getBookingMessages(chatId)
      .then((result) => setMessages(result.messages || []))
      .catch((error) => Alert.alert('Chat', error instanceof Error ? error.message : 'Unable to load chat.'))
      .finally(() => setIsLoading(false));

    socketRef.current = socketService.initializeConnection();
    const socket = socketRef.current;

    const joinRoom = () => {
      setIsConnected(true);
      socket.emit('join_chat_room', { bookingId: chatId });
    };

    socket.on('connect', joinRoom);
    socket.on('connect_error', () => setIsConnected(false));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('chat_message_sent', appendMessage);

    if (socket.connected) joinRoom();

    return () => {
      socket.off('connect', joinRoom);
      socket.off('connect_error');
      socket.off('disconnect');
      socket.off('chat_message_sent', appendMessage);
    };
  }, [chatId]);

  const sendMessage = async (text: string, mediaIds: string[] = []) => {
    if (!chatId || (!text.trim() && !mediaIds.length)) return;
    setIsSending(true);
    try {
      const result = await apiService.sendBookingMessage(chatId, {
        text: text.trim(),
        mediaIds,
      });
      appendMessage(result.message);
      setInputText('');
    } catch (error) {
      Alert.alert('Message not sent', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = () => {
    void sendMessage(inputText);
  };

  const handlePickImage = async (source: 'camera' | 'library') => {
    if (!chatId || isSending) return;

    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', source === 'camera' ? 'Camera access is needed to take a photo.' : 'Photo access is needed to send an image.');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const dataUri = toDataUri(asset);
    if (!dataUri) {
      Alert.alert('Image unavailable', 'Could not prepare this image for upload.');
      return;
    }

    setIsSending(true);
    try {
      const uploaded = await apiService.uploadBookingMedia(chatId, {
        dataUri,
        fileName: asset.fileName || `chat-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        purpose: 'CHAT',
      });
      const sent = await apiService.sendBookingMessage(chatId, {
        text: '',
        mediaIds: [uploaded.media.id],
      });
      appendMessage(sent.message);
    } catch (error) {
      Alert.alert('Image not sent', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const renderMedia = (media: JobMediaRecord[]) => (
    <View style={styles.mediaGrid}>
      {media.map((item) => (
        <Image key={item.id} source={{ uri: item.thumbnailUrl || item.url }} style={styles.chatImage} />
      ))}
    </View>
  );

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isClient = item.senderRole === 'CUSTOMER';
    return (
      <View style={[styles.messageBubbleContainer, isClient ? styles.clientAlign : styles.techAlign]}>
        <View style={[styles.bubble, isClient ? styles.clientBubble : styles.techBubble]}>
          {item.media?.length ? renderMedia(item.media) : null}
          {item.text ? <Text style={styles.bubbleText}>{item.text}</Text> : null}
          <Text style={styles.timestampText}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.chatHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.techTitle}>{techName}</Text>
          <Text style={styles.jobRef}>Ticket Reference: {chatId || 'No active booking'}</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#00FF87' : '#EF4444' }]} />
          <Text style={styles.statusLabel}>{isConnected ? 'Live' : 'Offline'}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#00FF87" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.listContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputTray}>
          <TouchableOpacity style={styles.mediaButton} onPress={() => handlePickImage('camera')} disabled={!chatId || isSending}>
            <CameraIcon color="#CBD5E1" size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaButton} onPress={() => handlePickImage('library')} disabled={!chatId || isSending}>
            <ImageIconView color="#CBD5E1" size={18} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Send clear directions or security codes..."
            placeholderTextColor="#64748B"
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!!chatId && !isSending}
          />
          <TouchableOpacity
            style={[styles.sendButton, { opacity: inputText.trim() && !isSending ? 1 : 0.6 }]}
            onPress={handleSendText}
            disabled={!chatId || !inputText.trim() || isSending}
          >
            {isSending ? <ActivityIndicator color="#090D14" size="small" /> : <SendIcon color="#090D14" size={18} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#111827', borderBottomWidth: 1, borderColor: '#1E293B' },
  techTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  jobRef: { color: '#64748B', fontSize: 12, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#94A3B8', fontSize: 13 },
  listContainer: { padding: 16, gap: 12 },
  messageBubbleContainer: { flexDirection: 'row', width: '100%', marginBottom: 4 },
  clientAlign: { justifyContent: 'flex-end' },
  techAlign: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 16 },
  clientBubble: { backgroundColor: '#00FF8715', borderWidth: 1, borderColor: '#00FF8730', borderBottomRightRadius: 4 },
  techBubble: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#E2E8F0', fontSize: 14, lineHeight: 20 },
  timestampText: { color: '#64748B', fontSize: 9, alignSelf: 'flex-end', marginTop: 4, fontWeight: '600' },
  mediaGrid: { gap: 8, marginBottom: 6 },
  chatImage: { width: 190, height: 140, borderRadius: 10, backgroundColor: '#090D14' },
  inputTray: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#111827', borderTopWidth: 1, borderColor: '#1E293B', gap: 8 },
  mediaButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#090D14', borderWidth: 1, borderColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  textInput: { flex: 1, backgroundColor: '#090D14', borderWidth: 1, borderColor: '#1E293B', color: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 80, minHeight: 40 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00FF87', justifyContent: 'center', alignItems: 'center' },
});

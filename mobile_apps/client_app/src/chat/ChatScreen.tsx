// src/screens/chat/ChatScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../services/socket.service';

interface ChatMessage {
  id: string;
  senderRole: 'client' | 'technician';
  text: string;
  timestamp: string;
}

export function ChatScreen({ route }: any): React.JSX.Element {
  // Pull parameters passed from the active job allocation context safely
  const { bookingId, jobId, techName } = route?.params || { bookingId: 'JOB-9921', jobId: 'JOB-9921', techName: 'Andrew Murray' };
  const chatId = bookingId ?? jobId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  const socketRef = useRef<ReturnType<typeof socketService.initializeConnection> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Connect to your unified platform socket engine instance 
    socketRef.current = socketService.initializeConnection();

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log(`[ChatSocket] Linked. Joining chat room for: ${chatId}`);
      
      // Request server to place this socket socket line inside the correct chat room
      socket.emit('join_chat_room', { bookingId: chatId });
    });

    if (socket.connected) {
      setIsConnected(true);
      socket.emit('join_chat_room', { bookingId: chatId });
    }

    // Handle incoming messages dispatched from the technician app
    socket.on('incoming_chat_msg', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    // Seed mock initial greeting structure to replicate real historical state context
    setMessages([
      {
        id: 'init-1',
        senderRole: 'technician',
        text: `Hi there, this is ${techName}. I am gathering tools and heading out to your location shortly.`,
        timestamp: new Date(Date.now() - 600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    return () => {
      socket.off('incoming_chat_msg');
      socket.off('connect');
      socket.off('connect_error');
    };
  }, [chatId, techName]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !socketRef.current) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderRole: 'client',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Emit out message payload to the server room conduit matrix immediately
    socketRef.current.emit('send_chat_msg', { bookingId: chatId, message: newMessage });

    // Append localized status state directly to screen view for instant confirmation
    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isClient = item.senderRole === 'client';
    return (
      <View style={[styles.messageBubbleContainer, isClient ? styles.clientAlign : styles.techAlign]}>
        <View style={[styles.bubble, isClient ? styles.clientBubble : styles.techBubble]}>
          <Text style={styles.bubbleText}>{item.text}</Text>
          <Text style={styles.timestampText}>{item.timestamp}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      
      {/* Upper Context Bar */}
      <View style={styles.chatHeader}>
        <View>
          <Text style={styles.techTitle}>{techName}</Text>
          <Text style={styles.jobRef}>Ticket Reference: {chatId}</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#00FF87' : '#EF4444' }]} />
          <Text style={styles.statusLabel}>{isConnected ? 'Live Sync' : 'Reconnecting'}</Text>
        </View>
      </View>

      {/* Message List Loop viewport */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.listContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input Tray HUD Wrapper */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputTray}>
          <TextInput
            style={styles.textInput}
            placeholder="Send clear directions or security codes..."
            placeholderTextColor="#64748B"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, { opacity: inputText.trim() ? 1 : 0.6 }]} 
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendIcon}>➔</Text>
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
  listContainer: { padding: 16, gap: 12 },
  messageBubbleContainer: { flexDirection: 'row', width: '100%', marginBottom: 4 },
  clientAlign: { justifyContent: 'flex-end' },
  techAlign: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  clientBubble: { backgroundColor: '#00FF8715', borderWidth: 1, borderColor: '#00FF8730', borderBottomRightRadius: 4 },
  techBubble: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#E2E8F0', fontSize: 14, lineHeight: 20 },
  timestampText: { color: '#64748B', fontSize: 9, alignSelf: 'flex-end', marginTop: 4, fontWeight: '600' },
  inputTray: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#111827', borderTopWidth: 1, borderColor: '#1E293B', gap: 10 },
  textInput: { flex: 1, backgroundColor: '#090D14', borderWidth: 1, borderColor: '#1E293B', color: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 80, minHeight: 40 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00FF87', justifyContent: 'center', alignItems: 'center' },
  sendIcon: { color: '#090D14', fontSize: 16, fontWeight: '800' }
});

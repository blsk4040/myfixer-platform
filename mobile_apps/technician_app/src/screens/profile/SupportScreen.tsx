import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, MessageCircle, Plus, RefreshCw, Send } from 'lucide-react-native';
import apiService, { SupportMessage, SupportTicket } from '../../services/api.service';

const Colors = {
  background: '#0B0B0D',
  surface: '#17171A',
  surfaceRaised: '#222226',
  input: '#121215',
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

const supportTopics = [
  { label: 'Payouts', value: 'PAYOUT' },
  { label: 'Document approval', value: 'DOCUMENTS' },
  { label: 'Jobs', value: 'JOBS' },
  { label: 'Account', value: 'ACCOUNT' },
  { label: 'General', value: 'GENERAL' },
];

const triageSuggestions: Record<string, string[]> = {
  PAYOUT: [
    'Check Earnings for your latest payout update.',
    'Confirm your payout method is complete and active.',
  ],
  DOCUMENTS: [
    'Make sure the photo or document is clear and matches your Padi Pro profile.',
    'Profile photos and documents need approval before you can go live.',
  ],
  JOBS: [
    'Check Jobs for incoming, active, scheduled and completed work.',
    'Keep your location on and duty status updated while we check.',
  ],
  ACCOUNT: [
    'Check Profile and Security for your password, devices and account activity.',
    'Make sure your email and phone number are up to date.',
  ],
  GENERAL: [
    'Add any job, payout, quote or invoice reference if you have one.',
    'Describe what happened and what you expected to happen.',
  ],
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusLabel = (status: SupportTicket['status']): string => {
  if (status === 'PENDING') return 'Waiting on Padi';
  if (status === 'RESOLVED') return 'Resolved';
  return 'Open';
};

export function SupportScreen(): React.JSX.Element {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('PAYOUT');
  const [bookingReference, setBookingReference] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [replyText, setReplyText] = useState('');

  const activeTopic = useMemo(
    () => supportTopics.find((topic) => topic.value === category) || supportTopics[0],
    [category]
  );
  const activeSuggestions = triageSuggestions[category] || triageSuggestions.GENERAL;

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [selectedTicketId, tickets]
  );

  const loadTickets = useCallback(async (preferredTicketId?: string) => {
    const result = await apiService.getSupportTickets();
    const nextTickets = result.tickets || [];
    setTickets(nextTickets);
    const nextSelectedId =
      preferredTicketId && nextTickets.some((ticket) => ticket.id === preferredTicketId)
        ? preferredTicketId
        : selectedTicketId && nextTickets.some((ticket) => ticket.id === selectedTicketId)
          ? selectedTicketId
          : nextTickets[0]?.id || '';
    setSelectedTicketId(nextSelectedId);
    if (!nextTickets.length) setShowNewTicket(true);
    return nextSelectedId;
  }, [selectedTicketId]);

  const loadMessages = useCallback(async (ticketId: string) => {
    if (!ticketId) {
      setMessages([]);
      return;
    }
    const result = await apiService.getSupportTicketMessages(ticketId);
    setMessages(result.messages || []);
  }, []);

  const loadAll = useCallback(async (preferredTicketId?: string) => {
    const ticketId = await loadTickets(preferredTicketId);
    await loadMessages(ticketId);
  }, [loadMessages, loadTickets]);

  useEffect(() => {
    loadAll()
      .catch((error: Error) => Alert.alert('Support', error.message))
      .finally(() => setLoading(false));
  }, [loadAll]);

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedTicketId).catch((error: Error) => Alert.alert('Support', error.message));
  }, [loadMessages, selectedTicketId]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadAll(selectedTicketId);
    } catch (error) {
      Alert.alert('Support', error instanceof Error ? error.message : 'Unable to refresh support.');
    } finally {
      setRefreshing(false);
    }
  };

  const createTicket = async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = firstMessage.trim();
    if (!trimmedSubject) {
      Alert.alert('Support', 'Add a short subject for your support conversation.');
      return;
    }
    if (!trimmedMessage) {
      Alert.alert('Support', 'Tell Padi Support what you need help with.');
      return;
    }

    setCreating(true);
    try {
      const reference = bookingReference.trim();
      const triageMessage = [
        `Issue type: ${activeTopic.label}`,
        `Reference: ${reference || 'Not provided'}`,
        '',
        'Details:',
        trimmedMessage,
      ].join('\n');
      const result = await apiService.createSupportTicket({
        subject: trimmedSubject,
        message: triageMessage,
        category,
        triage: {
          issueType: category,
          bookingReference: reference,
          suggestedFixesViewed: activeSuggestions,
          handoffReason: 'Padi Pro requested human support after bot triage',
        },
      });
      setSubject('');
      setBookingReference('');
      setFirstMessage('');
      setCategory('PAYOUT');
      setShowNewTicket(false);
      await loadAll(result.ticket.id);
    } catch (error) {
      Alert.alert('Support', error instanceof Error ? error.message : 'Unable to start support conversation.');
    } finally {
      setCreating(false);
    }
  };

  const sendReply = async () => {
    const text = replyText.trim();
    if (!selectedTicketId || !text) return;
    setSending(true);
    try {
      await apiService.sendSupportMessage(selectedTicketId, text);
      setReplyText('');
      await loadAll(selectedTicketId);
    } catch (error) {
      Alert.alert('Support', error instanceof Error ? error.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <MessageCircle color={Colors.primary} size={24} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Help & Support</Text>
              <Text style={styles.heroText}>
                Chat with Padi Support about payouts, document approval, jobs or your account.
              </Text>
            </View>
          </View>

          <View style={styles.toolbar}>
            <Text style={styles.sectionTitle}>Conversations</Text>
            <View style={styles.toolbarActions}>
              <TouchableOpacity style={styles.iconButton} onPress={refresh} activeOpacity={0.8}>
                <RefreshCw color={Colors.text} size={16} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.newButton, showNewTicket && styles.newButtonActive]}
                onPress={() => setShowNewTicket((value) => !value)}
                activeOpacity={0.85}
              >
                <Plus color={showNewTicket ? Colors.background : Colors.primary} size={16} />
                <Text style={[styles.newButtonText, showNewTicket && styles.newButtonTextActive]}>New</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showNewTicket ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Start with Padi Assistant</Text>
              <Text style={styles.formIntro}>
                Answer a few quick questions first. If you still need help, Padi Support will reply here.
              </Text>
              <Text style={styles.label}>Issue type</Text>
              <View style={styles.topicGrid}>
                {supportTopics.map((topic) => {
                  const active = category === topic.value;
                  return (
                    <TouchableOpacity
                      key={topic.value}
                      style={[styles.topicPill, active && styles.topicPillActive]}
                      onPress={() => setCategory(topic.value)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.topicText, active && styles.topicTextActive]}>{topic.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Job, payout or document reference</Text>
              <TextInput
                value={bookingReference}
                onChangeText={setBookingReference}
                placeholder="Optional reference"
                placeholderTextColor={Colors.textSubtle}
                style={styles.input}
                autoCapitalize="characters"
              />

              <View style={styles.botCard}>
                <Text style={styles.botTitle}>Try this first</Text>
                {activeSuggestions.map((suggestion) => (
                  <Text key={suggestion} style={styles.botText}>- {suggestion}</Text>
                ))}
              </View>

              <Text style={styles.label}>Subject</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="What do you need help with?"
                placeholderTextColor={Colors.textSubtle}
                style={styles.input}
              />

              <Text style={styles.label}>Message</Text>
              <TextInput
                value={firstMessage}
                onChangeText={setFirstMessage}
                placeholder="Tell us what happened."
                placeholderTextColor={Colors.textSubtle}
                style={[styles.input, styles.messageInput]}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowNewTicket(false)} activeOpacity={0.85}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={createTicket} activeOpacity={0.85} disabled={creating}>
                  {creating ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.primaryButtonText}>Submit</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {tickets.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ticketRail}>
              {tickets.map((ticket) => {
                const active = ticket.id === selectedTicketId;
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    style={[styles.ticketChip, active && styles.ticketChipActive]}
                    activeOpacity={0.85}
                    onPress={() => setSelectedTicketId(ticket.id)}
                  >
                    <Text style={[styles.ticketSubject, active && styles.ticketSubjectActive]} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    <Text style={[styles.ticketMeta, active && styles.ticketMetaActive]}>{statusLabel(ticket.status)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {selectedTicket ? (
            <View style={styles.chatCard}>
              <View style={styles.chatHeader}>
                <View>
                  <Text style={styles.chatTitle}>{selectedTicket.subject}</Text>
                  <Text style={styles.chatMeta}>
                    {selectedTicket.ticketNumber} / {statusLabel(selectedTicket.status)}
                  </Text>
                </View>
                {selectedTicket.status === 'RESOLVED' ? <CheckCircle2 color={Colors.primary} size={22} /> : null}
              </View>

              <View style={styles.messageStack}>
                {messages.length ? messages.map((message) => {
                  const mine = message.senderType === 'TECHNICIAN';
                  return (
                    <View key={message.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleAgent]}>
                      <Text style={[styles.bubbleAuthor, mine ? styles.bubbleAuthorMine : styles.bubbleAuthorAgent]}>
                        {mine ? 'You' : 'Padi Support'}
                      </Text>
                      <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextAgent]}>
                        {message.text}
                      </Text>
                      <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeAgent]}>
                        {formatDateTime(message.createdAt)}
                      </Text>
                    </View>
                  );
                }) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No messages yet.</Text>
                    <Text style={styles.emptyText}>Send a message and Padi Support will reply here.</Text>
                  </View>
                )}
              </View>

              <View style={styles.replyRow}>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Write a reply..."
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.replyInput}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!replyText.trim() || sending) && styles.sendButtonDisabled]}
                  onPress={sendReply}
                  activeOpacity={0.85}
                  disabled={!replyText.trim() || sending}
                >
                  {sending ? <ActivityIndicator color={Colors.background} /> : <Send color={Colors.background} size={18} />}
                </TouchableOpacity>
              </View>
            </View>
          ) : !showNewTicket ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No support conversations yet.</Text>
              <Text style={styles.emptyText}>Start a chat when you need help from Padi Support.</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  keyboardView: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContainer: { padding: 20, paddingBottom: 120 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  heroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(184, 255, 61, 0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(184, 255, 61, 0.35)' },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  heroText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  toolbar: { marginTop: 24, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  newButton: { height: 36, borderRadius: 18, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.primary, backgroundColor: 'rgba(184, 255, 61, 0.08)' },
  newButtonActive: { backgroundColor: Colors.primary },
  newButtonText: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  newButtonTextActive: { color: Colors.background },
  formCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 },
  formTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  formIntro: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 10 },
  label: { color: Colors.textSubtle, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, marginTop: 10 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  topicPill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.input },
  topicPillActive: { borderColor: Colors.primary, backgroundColor: 'rgba(184, 255, 61, 0.14)' },
  topicText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  topicTextActive: { color: Colors.primary },
  input: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.input, color: Colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  messageInput: { minHeight: 112 },
  botCard: { borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(184, 255, 61, 0.22)', backgroundColor: 'rgba(184, 255, 61, 0.07)', padding: 12, marginTop: 12 },
  botTitle: { color: Colors.primary, fontSize: 12, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' },
  botText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  primaryButton: { minWidth: 112, minHeight: 44, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 44, borderRadius: Radius.md, backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  ticketRail: { gap: 10, paddingBottom: 14 },
  ticketChip: { width: 190, borderRadius: Radius.md, padding: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  ticketChipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(184, 255, 61, 0.10)' },
  ticketSubject: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  ticketSubjectActive: { color: Colors.primary },
  ticketMeta: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', marginTop: 5 },
  ticketMetaActive: { color: Colors.textMuted },
  chatCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  chatHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chatTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  chatMeta: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', marginTop: 4 },
  messageStack: { padding: 14, gap: 12 },
  bubble: { maxWidth: '88%', borderRadius: 18, padding: 12 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  bubbleAgent: { alignSelf: 'flex-start', backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border },
  bubbleAuthor: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 5 },
  bubbleAuthorMine: { color: Colors.background },
  bubbleAuthorAgent: { color: Colors.primary },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: Colors.background },
  bubbleTextAgent: { color: Colors.text },
  bubbleTime: { fontSize: 10, marginTop: 7 },
  bubbleTimeMine: { color: 'rgba(11, 11, 13, 0.68)' },
  bubbleTimeAgent: { color: Colors.textSubtle },
  replyRow: { padding: 12, borderTopWidth: 1, borderTopColor: Colors.border, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  replyInput: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, color: Colors.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  emptyState: { alignItems: 'center', padding: 24, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { color: Colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' },
});

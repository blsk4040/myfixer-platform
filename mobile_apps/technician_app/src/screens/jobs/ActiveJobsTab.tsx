// mobile_apps/technician_app/src/screens/jobs/ActiveJobsTab.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { JobPayload, JobStatus, useJobStore } from '../../store/useJobStore';
import apiService, { BookingChatMessage, JobMediaRecord } from '../../services/api.service';
import techSocketService from '../../services/tech_socket.service';
import { NotificationService } from '../../services/notification.service';

type Message = BookingChatMessage;

const toDataUri = (asset: ImagePicker.ImagePickerAsset): string | null => {
  if (!asset.base64) return null;
  return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
};

const messageTime = (value: string): string =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getActionButtonProps = (status: string | undefined) => {
  switch (status) {
    case 'ACCEPTED':
      return { text: "I'm on my way", color: '#00FF87', textColor: '#090D14', stageLabel: 'Accepted' };
    case 'IN_ROUTE':
      return { text: "I've arrived", color: '#F59E0B', textColor: '#090D14', stageLabel: 'On my way' };
    case 'ARRIVED':
      return { text: 'Diagnosis done', color: '#38BDF8', textColor: '#090D14', stageLabel: 'Arrived' };
    case 'DIAGNOSTIC_DONE':
      return { text: 'Complete job', color: '#00FF87', textColor: '#090D14', stageLabel: 'Diagnosis done' };
    default:
      return { text: 'Next step', color: '#1E293B', textColor: '#FFFFFF', stageLabel: 'In progress' };
  }
};

const getNextStatus = (status: JobStatus | undefined): Exclude<JobStatus, 'IDLE'> | null => {
  switch (status) {
    case 'ACCEPTED':
      return 'IN_ROUTE';
    case 'IN_ROUTE':
      return 'ARRIVED';
    case 'ARRIVED':
      return 'DIAGNOSTIC_DONE';
    case 'DIAGNOSTIC_DONE':
      return 'COMPLETED';
    default:
      return null;
  }
};

const getStageBlockReason = (job: JobPayload, quoteApproved: boolean): string => {
  if (!job.jobStatus) return 'This job has not been accepted yet.';
  if (job.jobStatus === 'DIAGNOSTIC_DONE' && !quoteApproved) return 'The client has not approved the quote yet.';
  if (job.jobStatus === 'COMPLETED') return 'This job is already complete.';
  return 'Waiting for the client.';
};

export function ActiveJobsTab(): React.JSX.Element {
  const activeJobs = useJobStore((state) => state.activeJobs);
  const advanceJobStatus = useJobStore((state) => state.advanceJobStatus);

  const [chatVisible, setChatVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobPayload | null>(null);
  const [typedMessage, setTypedMessage] = useState('');
  const [chatThreads, setChatThreads] = useState<Record<string, Message[]>>({});
  const [jobPhotos, setJobPhotos] = useState<Record<string, string>>({});
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [activeInvoiceJob, setActiveInvoiceJob] = useState<JobPayload | null>(null);
  const [additionalLabor, setAdditionalLabor] = useState('');
  const [partsAmount, setPartsAmount] = useState('');
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [approvedQuoteJobIds, setApprovedQuoteJobIds] = useState<Set<string>>(new Set());
  const [sentQuoteJobIds, setSentQuoteJobIds] = useState<Set<string>>(new Set());
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);

  const appendChatMessage = (bookingId: string, message: BookingChatMessage) => {
    setChatThreads((prev) => {
      const current = prev[bookingId] || [];
      if (current.some((item) => item.id === message.id)) return prev;
      return {
        ...prev,
        [bookingId]: [...current, message],
      };
    });
  };

  useEffect(() => {
    const socket = techSocketService.getSocket();
    if (!socket) return undefined;

    const handleQuoteApproved = (quote: { bookingId?: string }) => {
      if (!quote.bookingId) return;
      setApprovedQuoteJobIds((prev) => new Set(prev).add(String(quote.bookingId)));
    };

    const handleQuoteRejected = (quote: { bookingId?: string }) => {
      if (!quote.bookingId) return;
      setSentQuoteJobIds((prev) => {
        const next = new Set(prev);
        next.delete(String(quote.bookingId));
        return next;
      });
      setApprovedQuoteJobIds((prev) => {
        const next = new Set(prev);
        next.delete(String(quote.bookingId));
        return next;
      });
      Alert.alert('Quote rejected', 'The client rejected the quote. You can revise it or close the visit.');
    };

    socket.on('quote_approved', handleQuoteApproved);
    socket.on('quote_rejected', handleQuoteRejected);

    return () => {
      socket.off('quote_approved', handleQuoteApproved);
      socket.off('quote_rejected', handleQuoteRejected);
    };
  }, []);

  useEffect(() => {
    if (!chatVisible || !selectedJob) return undefined;

    let mounted = true;
    setChatLoading(true);
    apiService.getBookingMessages(selectedJob.id)
      .then((result) => {
        if (!mounted) return;
        setChatThreads((prev) => ({
          ...prev,
          [selectedJob.id]: result.messages || [],
        }));
      })
      .catch((error) => Alert.alert('Chat', error instanceof Error ? error.message : 'Unable to load chat.'))
      .finally(() => {
        if (mounted) setChatLoading(false);
      });

    const socket = techSocketService.getSocket();
    if (!socket) {
      return () => {
        mounted = false;
      };
    }

    socket.emit('join_chat_room', { bookingId: selectedJob.id });
    const handleChatMessage = (message: BookingChatMessage) => {
      if (String(message.bookingId) === selectedJob.id) {
        appendChatMessage(selectedJob.id, message);
      }
    };

    socket.on('chat_message_sent', handleChatMessage);

    return () => {
      mounted = false;
      socket.off('chat_message_sent', handleChatMessage);
    };
  }, [chatVisible, selectedJob]);

  const handlePhoneCall = (phoneNum: string = '0825550192') => {
    const url = `tel:${phoneNum}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (!supported) {
          Alert.alert('Call unavailable', 'Phone calls are not supported on this device.');
        } else {
          return Linking.openURL(url);
        }
      })
      .catch((err) => console.error(err));
  };

  const handleNavigate = (job: JobPayload) => {
    const latitude = Number(job.latitude);
    const longitude = Number(job.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Navigation unavailable', 'This job does not have valid GPS coordinates yet.');
      return;
    }

    const label = encodeURIComponent(job.fullAddress || job.applianceType || 'Client location');
    const latLng = `${latitude},${longitude}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latLng}`,
      android: `geo:0,0?q=${latLng}(${label})`,
    });

    if (url) Linking.openURL(url);
  };

  const openChatModal = (job: JobPayload) => {
    setSelectedJob(job);
    setChatVisible(true);
  };

  const sendMessage = async () => {
    if (!typedMessage.trim() || !selectedJob) return;

    try {
      setChatSending(true);
      const result = await apiService.sendBookingMessage(selectedJob.id, {
        text: typedMessage.trim(),
      });
      appendChatMessage(selectedJob.id, result.message);
      setTypedMessage('');
    } catch (error) {
      Alert.alert('Message not sent', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setChatSending(false);
    }
  };

  const sendChatPhoto = async () => {
    if (!selectedJob || chatSending) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Photo access needed', 'Turn on photo access to send an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const dataUri = toDataUri(asset);
    if (!dataUri) {
      Alert.alert('Image unavailable', 'Could not prepare this image for upload.');
      return;
    }

    try {
      setChatSending(true);
      const uploaded = await apiService.uploadBookingMedia(selectedJob.id, {
        dataUri,
        fileName: asset.fileName || `chat-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        purpose: 'CHAT',
      });
      const sent = await apiService.sendBookingMessage(selectedJob.id, {
        mediaIds: [uploaded.media.id],
      });
      appendChatMessage(selectedJob.id, sent.message);
    } catch (error) {
      Alert.alert('Image not sent', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setChatSending(false);
    }
  };

  const takeJobProofPhoto = async (jobId: string) => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Camera access needed', 'Turn on camera permissions to add a proof photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const dataUri = toDataUri(asset);
      if (!dataUri) {
        Alert.alert('Image unavailable', 'Could not prepare this photo for upload.');
        return;
      }

      try {
        const uploaded = await apiService.uploadBookingMedia(jobId, {
          dataUri,
          fileName: asset.fileName || `proof-${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          purpose: 'PROOF_OF_COMPLETION',
        });
        setJobPhotos((prev) => ({ ...prev, [jobId]: uploaded.media.url }));
      } catch (error) {
        Alert.alert('Upload failed', error instanceof Error ? error.message : 'Could not upload proof photo.');
      }
    }
  };

  const openQuoteSheet = (job: JobPayload) => {
    setActiveInvoiceJob(job);
    setAdditionalLabor('');
    setPartsAmount('');
    setInvoiceModalVisible(true);
  };

  const handleStatusPress = async (job: JobPayload) => {
    if (job.jobStatus === 'DIAGNOSTIC_DONE') {
      if (!approvedQuoteJobIds.has(job.id)) {
        openQuoteSheet(job);
        return;
      }

      if (!jobPhotos[job.id]) {
        Alert.alert('Proof photo needed', 'Add a proof photo before completing this job.');
        return;
      }

      openQuoteSheet(job);
      return;
    }

    const nextStatus = getNextStatus(job.jobStatus);
    if (!nextStatus) {
      Alert.alert('Next step unavailable', getStageBlockReason(job, approvedQuoteJobIds.has(job.id)));
      return;
    }

    try {
      await apiService.updateBookingStatus(job.id, nextStatus);
    } catch (error: any) {
      Alert.alert('Status update failed', error.message || 'Could not update this job.');
      return;
    }

    advanceJobStatus(job.id);
    if (nextStatus === 'ARRIVED') {
      await NotificationService.handleArrival(job.id);
    }
  };

  const handleSubmitFinalInvoice = async () => {
    if (!activeInvoiceJob) return;

    const baseCallout = Number(activeInvoiceJob.price) || 450;
    const laborNum = parseFloat(additionalLabor) || 0;
    const partsNum = parseFloat(partsAmount) || 0;
    const totalSettlement = baseCallout + laborNum + partsNum;

    try {
      setSubmittingInvoice(true);

      if (!approvedQuoteJobIds.has(activeInvoiceJob.id)) {
        const lineItems = [
          {
            type: 'CALLOUT' as const,
            label: 'Diagnostic callout fee',
            quantity: 1,
            unitAmount: baseCallout,
          },
          ...(laborNum > 0 ? [{
            type: 'LABOR' as const,
            label: 'Labour',
            quantity: 1,
            unitAmount: laborNum,
          }] : []),
          ...(partsNum > 0 ? [{
            type: 'PART' as const,
            label: 'Parts and materials',
            quantity: 1,
            unitAmount: partsNum,
          }] : []),
        ];

        await apiService.createJobQuote(activeInvoiceJob.id, {
          lineItems,
          technicianNotes: 'Please review and approve this quote before repairs continue.',
        });

        setSentQuoteJobIds((prev) => new Set(prev).add(activeInvoiceJob.id));
        setInvoiceModalVisible(false);
        Alert.alert('Quote sent', 'The client must approve this quote before you complete the job.');
        return;
      }

      await apiService.finalizeJobInvoice({
        bookingId: activeInvoiceJob.id,
        baseAmount: baseCallout,
        additionalLabor: laborNum,
        partsAmount: partsNum,
        totalAmount: totalSettlement,
        proofPhoto: jobPhotos[activeInvoiceJob.id] || '',
      });

      setInvoiceModalVisible(false);
      advanceJobStatus(activeInvoiceJob.id);
      await NotificationService.handlePayment(activeInvoiceJob.id);
      Alert.alert('Job completed', `R ${totalSettlement.toFixed(2)} has been added to your balance.`);
    } catch (error) {
      Alert.alert('Invoice failed', 'Could not save this invoice right now.');
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const basePriceValue = activeInvoiceJob ? (Number(activeInvoiceJob.price) || 450) : 450;
  const activeInvoiceCurrency = activeInvoiceJob?.currency || 'ZAR';
  const computedLiveTotal = basePriceValue + (parseFloat(additionalLabor) || 0) + (parseFloat(partsAmount) || 0);
  const isApprovedQuote = !!activeInvoiceJob && approvedQuoteJobIds.has(activeInvoiceJob.id);

  const renderChatMedia = (media: JobMediaRecord[] = []) => (
    <View style={styles.chatMediaGrid}>
      {media.map((item) => (
        <Image key={item.id} source={{ uri: item.thumbnailUrl || item.url }} style={styles.chatImage} />
      ))}
    </View>
  );

  if (activeJobs.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No active jobs</Text>
        <Text style={styles.emptyText}>Accepted jobs will appear here with your next step.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#090D14' }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {activeJobs.map((job) => {
          const currentProps = getActionButtonProps(job.jobStatus);
          const quoteApproved = approvedQuoteJobIds.has(job.id);
          const quoteSent = sentQuoteJobIds.has(job.id);

          return (
            <View key={job.id} style={[styles.jobCard, job.jobStatus === 'DIAGNOSTIC_DONE' && { borderColor: '#00FF8740' }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.applianceText}>{job.applianceType}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {job.jobStatus === 'DIAGNOSTIC_DONE' && quoteSent && !quoteApproved
                      ? 'Quote sent'
                      : currentProps.stageLabel}
                  </Text>
                </View>
              </View>

              <Text style={styles.faultText}>{job.faultDescription || 'No description provided.'}</Text>

              <View style={styles.priceRow}>
                <Text style={styles.metaLabel}>BASE CALLOUT</Text>
                <Text style={styles.priceValue}>{job.currency || 'ZAR'} {job.price}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.metaLabel}>CLIENT</Text>
              <Text style={styles.metaValue}>{job.customerName || 'Client'}</Text>

              <View style={styles.commsRow}>
                <TouchableOpacity style={styles.commsBtn} onPress={() => openChatModal(job)}>
                  <Text style={styles.commsBtnText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.commsBtn, { borderColor: '#38BDF820' }]} onPress={() => handlePhoneCall(job.customerPhone)}>
                  <Text style={[styles.commsBtnText, { color: '#38BDF8' }]}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.commsBtn, { borderColor: '#00FF8740' }]} onPress={() => handleNavigate(job)}>
                  <Text style={styles.commsBtnText}>Navigate</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.metaLabel, { marginTop: 10 }]}>ADDRESS</Text>
              <Text style={styles.metaValue}>{job.fullAddress || 'Address will appear after acceptance'}</Text>
              {job.complexDetails ? <Text style={styles.complexText}>{job.complexDetails}</Text> : null}

              {job.jobStatus === 'DIAGNOSTIC_DONE' && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.metaLabel}>PROOF PHOTO</Text>
                  {jobPhotos[job.id] ? (
                    <Image source={{ uri: jobPhotos[job.id] }} style={styles.receiptImagePreview} />
                  ) : (
                    <TouchableOpacity
                      style={[styles.commsBtn, { borderColor: '#EF444440', marginTop: 6, paddingVertical: 12 }]}
                      onPress={() => takeJobProofPhoto(job.id)}
                    >
                      <Text style={[styles.commsBtnText, { color: '#EF4444' }]}>Add Proof Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btnAction, { backgroundColor: currentProps.color }]}
                  activeOpacity={0.8}
                  onPress={() => handleStatusPress(job)}
                >
                  <Text style={[styles.btnTextDark, { color: currentProps.textColor }]}>
                    {job.jobStatus === 'DIAGNOSTIC_DONE' && !quoteApproved
                      ? quoteSent ? 'Quote sent - waiting for approval' : 'Send quote for approval'
                      : currentProps.text}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={chatVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.chatModalContainer}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatHeaderTitle}>{selectedJob?.customerName || 'Customer'} Chat</Text>
            <TouchableOpacity onPress={() => setChatVisible(false)} style={styles.closeChatBtn}>
              <Text style={styles.closeChatText}>Close</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={selectedJob ? chatThreads[selectedJob.id] || [] : []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatMessageList}
            ListEmptyComponent={
              <Text style={styles.chatEmptyText}>
                {chatLoading ? 'Loading chat...' : 'No messages yet.'}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.messageBubble, item.senderRole === 'TECHNICIAN' ? styles.bubbleTech : styles.bubbleClient]}>
                {item.media?.length ? renderChatMedia(item.media) : null}
                {item.text ? <Text style={styles.messageText}>{item.text}</Text> : null}
                <Text style={styles.messageTime}>{messageTime(item.createdAt)}</Text>
              </View>
            )}
          />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.inputAreaRow}>
              <TouchableOpacity style={styles.chatPhotoBtn} onPress={sendChatPhoto} disabled={chatSending || !selectedJob}>
                <Text style={styles.chatPhotoText}>Photo</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor="#64748B"
                value={typedMessage}
                onChangeText={setTypedMessage}
                editable={!chatSending}
              />
              <TouchableOpacity style={[styles.sendBtn, chatSending && { opacity: 0.6 }]} onPress={sendMessage} disabled={chatSending || !typedMessage.trim()}>
                {chatSending ? <ActivityIndicator color="#090D14" size="small" /> : <Text style={styles.sendBtnText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={invoiceModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setInvoiceModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.invoiceModalContent}>
            <Text style={styles.sheetTitle}>{isApprovedQuote ? 'Complete Job' : 'Send Quote'}</Text>
            <Text style={styles.sheetSubtitle}>
              Add labour and parts so the client can review the final amount.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Base callout</Text>
              <View style={[styles.inputWrapper, styles.disabledInputWrapper]}>
                <Text style={styles.currencyPrefix}>{activeInvoiceCurrency}</Text>
                <Text style={styles.disabledInputText}>{basePriceValue.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Labour ({activeInvoiceCurrency})</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>{activeInvoiceCurrency}</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  value={additionalLabor}
                  onChangeText={setAdditionalLabor}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Parts and materials ({activeInvoiceCurrency})</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>{activeInvoiceCurrency}</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  value={partsAmount}
                  onChangeText={setPartsAmount}
                />
              </View>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Client total</Text>
              <Text style={styles.summaryValue}>{activeInvoiceCurrency} {computedLiveTotal.toFixed(2)}</Text>
            </View>

            <View style={styles.invoiceActionRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setInvoiceModalVisible(false)}
                disabled={submittingInvoice}
              >
                <Text style={styles.backBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitInvoiceBtn}
                onPress={handleSubmitFinalInvoice}
                disabled={submittingInvoice}
              >
                {submittingInvoice ? (
                  <ActivityIndicator size="small" color="#090D14" />
                ) : (
                  <Text style={styles.submitInvoiceText}>{isApprovedQuote ? 'Complete Job' : 'Send Quote'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  jobCard: { backgroundColor: '#111827', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  applianceText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  statusBadge: { backgroundColor: '#1E293B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
  statusBadgeText: { color: '#00FF87', fontSize: 11, fontWeight: '700' },
  faultText: { color: '#94A3B8', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  priceValue: { color: '#00FF87', fontSize: 16, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#1E293B', marginVertical: 12 },
  metaLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  metaValue: { color: '#E2E8F0', fontSize: 14, fontWeight: '500', marginTop: 2 },
  complexText: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  commsRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 4 },
  commsBtn: { flex: 1, paddingVertical: 8, backgroundColor: '#090D14', borderWidth: 1, borderColor: '#1E293B', borderRadius: 8, alignItems: 'center' },
  commsBtnText: { color: '#00FF87', fontSize: 12, fontWeight: '700' },
  receiptImagePreview: { width: '100%', height: 160, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#00FF8730' },
  actionRow: { marginTop: 16 },
  btnAction: { paddingVertical: 14, alignItems: 'center', borderRadius: 10 },
  btnTextDark: { fontWeight: '700', fontSize: 14 },
  chatModalContainer: { flex: 1, backgroundColor: '#090D14' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B', alignItems: 'center' },
  chatHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  closeChatBtn: { padding: 6 },
  closeChatText: { color: '#EF4444', fontWeight: '600' },
  chatMessageList: { padding: 16, gap: 12 },
  chatEmptyText: { color: '#64748B', textAlign: 'center', marginTop: 40, fontSize: 13 },
  messageBubble: { padding: 12, borderRadius: 12, maxWidth: '80%', marginBottom: 4 },
  bubbleTech: { backgroundColor: '#1E293B', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  bubbleClient: { backgroundColor: '#111827', alignSelf: 'flex-start', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#1E293B' },
  messageText: { color: '#F8FAFC', fontSize: 14 },
  messageTime: { color: '#64748B', fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },
  chatMediaGrid: { gap: 8, marginBottom: 6 },
  chatImage: { width: 190, height: 140, borderRadius: 10, backgroundColor: '#090D14' },
  inputAreaRow: { flexDirection: 'row', padding: 12, backgroundColor: '#111827', borderTopWidth: 1, borderTopColor: '#1E293B', alignItems: 'center', gap: 8 },
  chatPhotoBtn: { height: 40, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#090D14', borderWidth: 1, borderColor: '#334155', justifyContent: 'center' },
  chatPhotoText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  chatInput: { flex: 1, height: 40, backgroundColor: '#090D14', borderRadius: 8, paddingHorizontal: 12, color: '#FFFFFF', fontSize: 13, borderWidth: 1, borderColor: '#1E293B' },
  sendBtn: { backgroundColor: '#00FF87', paddingHorizontal: 16, height: 40, borderRadius: 8, justifyContent: 'center' },
  sendBtnText: { color: '#090D14', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  invoiceModalContent: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1E293B' },
  sheetTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  sheetSubtitle: { color: '#64748B', fontSize: 12, marginTop: 4, lineHeight: 18, marginBottom: 20 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#090D14', borderWidth: 1, borderColor: '#1E293B', borderRadius: 10, paddingHorizontal: 12, height: 44 },
  disabledInputWrapper: { backgroundColor: '#1E293B40', borderColor: '#334155' },
  disabledInputText: { color: '#64748B', fontSize: 14, fontWeight: '600', marginLeft: 4 },
  currencyPrefix: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginRight: 2 },
  textInput: { flex: 1, color: '#FFFFFF', fontSize: 14, padding: 0, fontWeight: '600' },
  summaryBox: { backgroundColor: '#00FF870A', borderStyle: 'dashed', borderWidth: 1, borderColor: '#00FF8730', borderRadius: 12, padding: 14, marginVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  summaryValue: { color: '#00FF87', fontSize: 18, fontWeight: '800' },
  invoiceActionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  backBtn: { flex: 1, backgroundColor: '#1E293B', borderRadius: 10, height: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  backBtnText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  submitInvoiceBtn: { flex: 2, backgroundColor: '#00FF87', borderRadius: 10, height: 44, justifyContent: 'center', alignItems: 'center' },
  submitInvoiceText: { color: '#090D14', fontSize: 13, fontWeight: '700' },
});

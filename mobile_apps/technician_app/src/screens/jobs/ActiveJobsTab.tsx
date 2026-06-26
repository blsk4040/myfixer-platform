// mobile_apps/technician_app/src/screens/jobs/ActiveJobsTab.tsx
import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Linking, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useJobStore, JobPayload } from '../../store/useJobStore';

interface Message {
  id: string;
  text: string;
  sender: 'technician' | 'client';
  timestamp: string;
}

export function ActiveJobsTab(): React.JSX.Element {
  const activeJobs = useJobStore((state) => state.activeJobs);
  const advanceJobStatus = useJobStore((state) => state.advanceJobStatus);

  // Chat Modal States
  const [chatVisible, setChatVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobPayload | null>(null);
  const [typedMessage, setTypedMessage] = useState('');
  const [chatThreads, setChatThreads] = useState<Record<string, Message[]>>({
    'job_001': [
      { id: '1', text: 'Hi, what time will you arrive?', sender: 'client', timestamp: '14:02' },
    ]
  });

  // Proof of Work Photo Verification State
  const [jobPhotos, setJobPhotos] = useState<Record<string, string>>({});

  // DYNAMIC INVOICE SHEET STATES
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [activeInvoiceJob, setActiveInvoiceJob] = useState<JobPayload | null>(null);
  const [additionalLabor, setAdditionalLabor] = useState('');
  const [partsAmount, setPartsAmount] = useState('');
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  const getActionButtonProps = (status: string | undefined) => {
    switch (status) {
      case 'ACCEPTED':
        return { text: 'Start Travel (In Route)', color: '#00FF87', textColor: '#090D14', stageLabel: 'ACCEPTED' };
      case 'IN_ROUTE':
        return { text: 'Mark as Arrived', color: '#F59E0B', textColor: '#090D14', stageLabel: 'IN_ROUTE' };
      case 'ARRIVED':
        return { text: 'Complete Diagnostic', color: '#38BDF8', textColor: '#090D14', stageLabel: 'ARRIVED' };
      case 'DIAGNOSTIC_DONE':
        return { text: 'Collect Payment & Complete', color: '#00FF87', textColor: '#090D14', stageLabel: 'DIAGNOSTIC_DONE' };
      default:
        return { text: 'Advance Stage', color: '#1E293B', textColor: '#FFFFFF', stageLabel: 'IN_PROGRESS' };
    }
  };

  const handlePhoneCall = (phoneNum: string = '0825550192') => {
    const url = `tel:${phoneNum}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (!supported) {
          Alert.alert("Error", "Phone calls are not supported on this device framework.");
        } else {
          return Linking.openURL(url);
        }
      })
      .catch((err) => console.error(err));
  };

  const openChatModal = (job: JobPayload) => {
    setSelectedJob(job);
    setChatVisible(true);
  };

  const sendMessage = () => {
    if (!typedMessage.trim() || !selectedJob) return;
    
    const newMsg: Message = {
      id: Math.random().toString(),
      text: typedMessage.trim(),
      sender: 'technician',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatThreads(prev => ({
      ...prev,
      [selectedJob.id]: [...(prev[selectedJob.id] || []), newMsg]
    }));
    setTypedMessage('');
  };

  const takeJobProofPhoto = async (jobId: string) => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Camera access is needed to capture validation receipts.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setJobPhotos(prev => ({ ...prev, [jobId]: result.assets[0].uri }));
    }
  };

  const handleStatusPress = (job: JobPayload) => {
    if (job.jobStatus === 'DIAGNOSTIC_DONE') {
      if (!jobPhotos[job.id]) {
        Alert.alert(
          "Verification Missing", 
          "Please snap a validation proof photo of the machine profile state before finalizing invoice payments."
        );
        return;
      }

      // Open the custom calculation sheet overlay modal instead of a simple popup alert box
      setActiveInvoiceJob(job);
      setAdditionalLabor('');
      setPartsAmount('');
      setInvoiceModalVisible(true);
    } else {
      advanceJobStatus(job.id);
    }
  };

  // INVOICE HANDLER METHOD CONNECTED TO YOUR BACKEND API STRATEGY
  const handleSubmitFinalInvoice = async () => {
    if (!activeInvoiceJob) return;
    
    const baseCallout = Number(activeInvoiceJob.price) || 450;
    const laborNum = parseFloat(additionalLabor) || 0;
    const partsNum = parseFloat(partsAmount) || 0;
    const totalSettlement = baseCallout + laborNum + partsNum;

    try {
      setSubmittingInvoice(true);

      // Payload matching your MongoDB Billing Schema models
      const billingPayload = {
        bookingId: activeInvoiceJob.id,
        baseAmount: baseCallout,
        additionalLabor: laborNum,
        partsAmount: partsNum,
        totalAmount: totalSettlement,
        proofPhoto: jobPhotos[activeInvoiceJob.id] || ''
      };

      console.log('Dispatching Finalized Invoice Details to Node backend:', billingPayload);
      // In production: await axios.post('/api/v1/invoices/generate', billingPayload);

      setTimeout(() => {
        setSubmittingInvoice(false);
        setInvoiceModalVisible(false);
        
        // Execute original store transitions to cycle job away
        advanceJobStatus(activeInvoiceJob.id);
        Alert.alert("Revenue Synced", `Tax Invoice generated completely! R ${totalSettlement.toFixed(2)} has been credited to your platform wallet.`);
      }, 1200);

    } catch (error) {
      setSubmittingInvoice(false);
      Alert.alert("Error", "Could not synchronize invoice ledger calculations with the server.");
    }
  };

  // Live total computation helper variables for prompt UI reflection
  const basePriceValue = activeInvoiceJob ? (Number(activeInvoiceJob.price) || 450) : 450;
  const computedLiveTotal = basePriceValue + (parseFloat(additionalLabor) || 0) + (parseFloat(partsAmount) || 0);

  if (activeJobs.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No active jobs currently in progress.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#090D14' }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {activeJobs.map((job) => {
          const currentProps = getActionButtonProps(job.jobStatus);
          
          return (
            <View key={job.id} style={[styles.jobCard, job.jobStatus === 'DIAGNOSTIC_DONE' && { borderColor: '#00FF8740' }]}>
              
              <View style={styles.cardHeader}>
                <Text style={styles.applianceText}>{job.applianceType}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{currentProps.stageLabel}</Text>
                </View>
              </View>

              <Text style={styles.faultText}>{job.faultDescription || 'No description provided.'}</Text>
              
              <View style={styles.priceRow}>
                <Text style={styles.metaLabel}>BASE CALLOUT FEE</Text>
                <Text style={styles.priceValue}>R {job.price}</Text>
              </View>

              <View style={styles.divider} />
              
              <Text style={styles.metaLabel}>CLIENT</Text>
              <Text style={styles.metaValue}>{job.customerName || 'Private User'}</Text>
              
              <View style={styles.commsRow}>
                <TouchableOpacity style={styles.commsBtn} onPress={() => openChatModal(job)}>
                  <Text style={styles.commsBtnText}>💬 Direct Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.commsBtn, { borderColor: '#38BDF820' }]} onPress={() => handlePhoneCall()}>
                  <Text style={[styles.commsBtnText, { color: '#38BDF8' }]}>📞 Voice Call</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.metaLabel, { marginTop: 10 }]}>ADDRESS</Text>
              <Text style={styles.metaValue}>{job.fullAddress || 'Address details loaded'}</Text>
              {job.complexDetails ? <Text style={styles.complexText}>🏢 {job.complexDetails}</Text> : null}

              {job.jobStatus === 'DIAGNOSTIC_DONE' && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.metaLabel}>REPAIR / DIAGNOSTIC RECEIPT PROOF</Text>
                  {jobPhotos[job.id] ? (
                    <Image source={{ uri: jobPhotos[job.id] }} style={styles.receiptImagePreview} />
                  ) : (
                    <TouchableOpacity style={[styles.commsBtn, { borderColor: '#EF444440', marginTop: 6, paddingVertical: 12 }]} onPress={() => takeJobProofPhoto(job.id)}>
                      <Text style={[styles.commsBtnText, { color: '#EF4444' }]}>📸 Snap Proof of Work Photo (Required)</Text>
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
                    {currentProps.text}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* --- IN-APP CHAT OVERLAY SYSTEM --- */}
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
            renderItem={({ item }) => (
              <View style={[styles.messageBubble, item.sender === 'technician' ? styles.bubbleTech : styles.bubbleClient]}>
                <Text style={styles.messageText}>{item.text}</Text>
                <Text style={styles.messageTime}>{item.timestamp}</Text>
              </View>
            )}
          />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.inputAreaRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type operational update message..."
                placeholderTextColor="#64748B"
                value={typedMessage}
                onChangeText={setTypedMessage}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* --- DYNAMIC FINANCIAL JOB SHEET INVOICE OVERLAY MODAL --- */}
      <Modal
        visible={invoiceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInvoiceModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <View style={styles.invoiceModalContent}>
            <Text style={styles.sheetTitle}>Finalize Job Sheet Billing</Text>
            <Text style={styles.sheetSubtitle}>Enter additional variable labor charges or replacement components to compile the formal tax invoice summary.</Text>

            {/* Item 1: Callout Fee Display Only */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Base Diagnostic Callout (Fixed)</Text>
              <View style={[styles.inputWrapper, styles.disabledInputWrapper]}>
                <Text style={styles.currencyPrefix}>R</Text>
                <Text style={styles.disabledInputText}>{basePriceValue.toFixed(2)}</Text>
              </View>
            </View>

            {/* Item 2: Additional Labor Cost */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Extended Labor Charges (ZAR)</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>R</Text>
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

            {/* Item 3: Parts & Materials */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Acquired Materials & Component Parts (ZAR)</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>R</Text>
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

            {/* Total Computation Box Summary */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Total Due from Client:</Text>
              <Text style={styles.summaryValue}>R {computedLiveTotal.toFixed(2)}</Text>
            </View>

            {/* Modal Actions Button Row */}
            <View style={styles.invoiceActionRow}>
              <TouchableOpacity 
                style={styles.backBtn} 
                onPress={() => setInvoiceModalVisible(false)}
                disabled={submittingInvoice}
              >
                <Text style={styles.backBtnText}>Go Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.submitInvoiceBtn} 
                onPress={handleSubmitFinalInvoice}
                disabled={submittingInvoice}
              >
                {submittingInvoice ? (
                  <ActivityIndicator size="small" color="#090D14" />
                ) : (
                  <Text style={styles.submitInvoiceText}>Confirm & Close</Text>
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
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center' },
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
  
  // Chat Modal Sub Styles
  chatModalContainer: { flex: 1, backgroundColor: '#090D14' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B', alignItems: 'center' },
  chatHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  closeChatBtn: { padding: 6 },
  closeChatText: { color: '#EF4444', fontWeight: '600' },
  chatMessageList: { padding: 16, gap: 12 },
  messageBubble: { padding: 12, borderRadius: 12, maxWidth: '80%', marginBottom: 4 },
  bubbleTech: { backgroundColor: '#1E293B', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  bubbleClient: { backgroundColor: '#111827', alignSelf: 'flex-start', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#1E293B' },
  messageText: { color: '#F8FAFC', fontSize: 14 },
  messageTime: { color: '#64748B', fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },
  inputAreaRow: { flexDirection: 'row', padding: 12, backgroundColor: '#111827', borderTopWidth: 1, borderTopColor: '#1E293B', alignItems: 'center', gap: 8 },
  chatInput: { flex: 1, height: 40, backgroundColor: '#090D14', borderRadius: 8, paddingHorizontal: 12, color: '#FFFFFF', fontSize: 13, borderWidth: 1, borderColor: '#1E293B' },
  sendBtn: { backgroundColor: '#00FF87', paddingHorizontal: 16, height: 40, borderRadius: 8, justifyContent: 'center' },
  sendBtnText: { color: '#090D14', fontWeight: '700', fontSize: 13 },

  // OVERLAY INVOICE MATRIX ENGINE STYLES
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
  submitInvoiceText: { color: '#090D14', fontSize: 13, fontWeight: '700' }
});
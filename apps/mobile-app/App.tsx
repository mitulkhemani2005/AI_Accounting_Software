import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [role, setRole] = useState<'admin' | 'sub_user'>('sub_user');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>AI Accounting POS</Text>
        <View style={[styles.badge, connectionStatus === 'online' ? styles.badgeOnline : styles.badgeOffline]}>
          <Text style={styles.badgeText}>{connectionStatus.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeader}>Active Role: {role === 'admin' ? 'Admin (Owner)' : 'Sub-user (Staff Billing)'}</Text>
        <Text style={styles.cardDesc}>
          {role === 'sub_user' 
            ? 'Add-only mode: You can create new bills. Edit and delete permissions are blocked at the API level.'
            : 'Admin mode: Full POS and accounting control.'}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Counter Quick Sale (Offline-Ready)</Text>
        <TouchableOpacity style={styles.buttonPrimary}>
          <Text style={styles.buttonText}>+ New Counter Bill</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOnline: {
    backgroundColor: '#065f46',
  },
  badgeOffline: {
    backgroundColor: '#991b1b',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  buttonPrimary: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

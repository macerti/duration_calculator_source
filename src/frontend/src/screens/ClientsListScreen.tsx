import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, ActivityIndicator, RefreshControl, Animated } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RootStackParamList } from "../../App";
import { api, ApiError } from "../api/client";
import { Client } from "../types/engine";
import { useToast } from "../components/Toast";
import ResponsiveContainer from "../components/ResponsiveContainer";
import Breadcrumbs from "../components/Breadcrumbs";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { colors, radius, spacing, typography } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "ClientsList">;

export default function ClientsListScreen({ navigation }: Props) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const bp = useBreakpoint();
  const shakeX = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const list = await api.listClients();
      setClients(list);
      setError(null);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shake = () => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const createClient = async () => {
    if (newName.trim() === "") {
      setNameError(true);
      shake();
      return;
    }
    setCreating(true);
    try {
      const res = await api.createClient(newName.trim());
      setModalOpen(false);
      setNewName("");
      setNameError(false);
      toast.show(`Client "${res.name}" créé`, "success");
      await load();
      navigation.navigate("ClientDetail", { clientId: res.id, clientName: res.name });
    } catch (e: any) {
      toast.show(e instanceof ApiError ? e.message : "Erreur lors de la création", "error");
    } finally {
      setCreating(false);
    }
  };

  const deleteClient = (client: Client) => {
    // Optimistic: remove from the list immediately, nothing is actually
    // deleted server-side until the undo toast's countdown finishes.
    setClients((prev) => (prev ? prev.filter((c) => c.id !== client.id) : prev));
    toast.showUndo(
      `Client "${client.name}" supprimé`,
      () => {
        setClients((prev) => (prev ? [client, ...prev] : prev));
      },
      () => {
        api.deleteClient(client.id).catch(() => {
          toast.show("Erreur lors de la suppression — le client a été restauré.", "error");
          load();
        });
      }
    );
  };

  return (
    <ResponsiveContainer>
      <View style={styles.container}>
        <Breadcrumbs
          items={[
            { icon: "home-outline", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })) },
            { label: "Clients" },
          ]}
          onProfilePress={() => navigation.navigate("Profile")}
        />
        <View style={styles.header}>
          <Text style={styles.title}>Mes clients</Text>
          <Pressable style={styles.newButton} onPress={() => setModalOpen(true)}>
            <Text style={styles.newButtonText}>+ Nouveau client</Text>
          </Pressable>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {clients === null && !error && <ActivityIndicator style={{ marginTop: 40 }} />}

        {clients !== null && clients.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucun client pour le moment</Text>
            <Text style={styles.emptyBody}>
              Créez un client pour commencer un calcul de durée d'audit. Un client peut avoir plusieurs calculs au
              fil du temps.
            </Text>
          </View>
        )}

        {clients !== null && clients.length > 0 && (
          <FlatList
            data={clients}
            keyExtractor={(c) => String(c.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            numColumns={bp === "desktop" ? 2 : 1}
            key={bp}
            columnWrapperStyle={bp === "desktop" ? { gap: 12 } : undefined}
            renderItem={({ item }) => (
              <View style={[styles.clientCardRow, bp === "desktop" && { flex: 1 }]}>
                <Pressable
                  style={styles.clientCard}
                  onPress={() => navigation.navigate("ClientDetail", { clientId: item.id, clientName: item.name })}
                >
                  <Text style={styles.clientName}>{item.name}</Text>
                  <Text style={styles.clientMeta}>
                    {item.calculationCount ?? 0} calcul{(item.calculationCount ?? 0) !== 1 ? "s" : ""}
                  </Text>
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={() => deleteClient(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color="#c53030" />
                </Pressable>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { transform: [{ translateX: shakeX }] }]}>
            <Text style={styles.modalTitle}>Nouveau client</Text>
            <TextInput
              style={[styles.modalInput, nameError && styles.modalInputError]}
              value={newName}
              onChangeText={(t) => {
                setNewName(t);
                if (t.trim() !== "") setNameError(false);
              }}
              placeholder="Nom du client"
              placeholderTextColor="#999"
              autoFocus
            />
            {nameError && <Text style={styles.fieldErrorText}>Le nom du client est obligatoire.</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalCreateBtn} onPress={createClient} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalCreateText}>Créer</Text>}
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  title: { fontSize: typography.display, fontWeight: "700", color: colors.contentPrimary },
  newButton: { backgroundColor: colors.actionPrimary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md + 2 },
  newButtonText: { color: colors.actionPrimaryText, fontWeight: "600", fontSize: typography.body },
  errorBox: { backgroundColor: colors.errorSurface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: typography.body },
  emptyState: { marginTop: 40, alignItems: "center", paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: typography.title, fontWeight: "700", color: colors.contentPrimary, marginBottom: spacing.sm },
  emptyBody: { fontSize: typography.body, color: colors.contentTertiary, textAlign: "center", lineHeight: 19 },
  clientCardRow: { flexDirection: "row", alignItems: "stretch", gap: spacing.sm, marginBottom: spacing.md },
  clientCard: { flex: 1, backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderSubtle },
  clientName: { fontSize: typography.title, fontWeight: "700", color: colors.contentPrimary },
  clientMeta: { fontSize: typography.small, color: colors.contentTertiary, marginTop: spacing.xs },
  deleteBtn: { width: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.errorSurface, borderRadius: radius.xl },
  modalOverlay: { flex: 1, backgroundColor: colors.surfaceOverlay, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: { backgroundColor: colors.surfaceBase, borderRadius: radius.xxl, padding: spacing.xl, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: typography.title, fontWeight: "700", marginBottom: spacing.md },
  modalInput: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: typography.subtitle },
  modalInputError: { borderColor: colors.error },
  fieldErrorText: { color: colors.error, fontSize: typography.small, marginTop: 6, fontWeight: "600" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: spacing.lg, gap: spacing.sm + 2 },
  modalCancelBtn: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md + 2 },
  modalCancelText: { color: colors.contentSecondary, fontSize: typography.bodyLarge },
  modalCreateBtn: { backgroundColor: colors.actionPrimary, borderRadius: radius.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg + 2, minWidth: 80, alignItems: "center" },
  modalCreateText: { color: colors.actionPrimaryText, fontWeight: "600", fontSize: typography.bodyLarge },
});

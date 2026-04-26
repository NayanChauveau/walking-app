import { useEffect, useState } from "react";
import { Button, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createAppModules } from "@/src/composition/createAppModules";

const { userSettings } = createAppModules();
const { getUserHealthProfileUseCase, saveUserHealthProfileUseCase } = userSettings;

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getUserHealthProfileUseCase.execute();
        setWeightInput(profile.weightKg.toString());
        setHeightInput(profile.heightCm.toString());
      } catch (profileError) {
        console.error(profileError);
        setError("Impossible de charger les parametres.");
      }
    }

    loadProfile();
  }, []);

  async function handleSave() {
    const parsedWeight = Number(weightInput.replace(",", "."));
    const parsedHeight = Number(heightInput.replace(",", "."));

    try {
      setIsSaving(true);
      setError(null);
      setMessage(null);
      await saveUserHealthProfileUseCase.execute({
        weightKg: parsedWeight,
        heightCm: parsedHeight,
      });
      setMessage("Parametres enregistres.");
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message);
      } else {
        setError("Impossible d'enregistrer les parametres.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <ThemedText type="title">Parametres sante</ThemedText>
        <ThemedText>Poids (kg)</ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
          keyboardType="decimal-pad"
          value={weightInput}
          onChangeText={setWeightInput}
          placeholder="Ex: 72.5"
          placeholderTextColor={theme.icon}
        />
        <ThemedText>Taille (cm)</ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
          keyboardType="number-pad"
          value={heightInput}
          onChangeText={setHeightInput}
          placeholder="Ex: 178"
          placeholderTextColor={theme.icon}
        />
        <Button
          title={isSaving ? "Enregistrement..." : "Enregistrer"}
          onPress={handleSave}
          disabled={isSaving}
        />
        {message ? <ThemedText style={{ color: "#3fb950" }}>{message}</ThemedText> : null}
        {error ? <ThemedText style={{ color: "#ff4d4f" }}>{error}</ThemedText> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

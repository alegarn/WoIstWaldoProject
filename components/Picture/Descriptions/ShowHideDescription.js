import { View, Text, ScrollView, StyleSheet } from "react-native";
import Button from "../../UI/Button";
import InputDescription from "./InputDescription";
import LanguageSelector from "../../UI/LanguageSelector";
import CategoryChips from "../../UI/CategoryChips";


export default function ShowHideDescription({
  inputChangeHandler,
  submitHandler,
  onCancel,
  language,
  onLanguageChange,
  languageError,
  categories,
  categoriesError,
  onRetryCategories,
  selectedCategory,
  onCategorySelect,
}) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.column}>
          <View style={styles.field}>
            <Text style={styles.label}>Language</Text>
            <LanguageSelector
              value={language}
              onChange={onLanguageChange}
              variant="overlay"
              testIDPrefix="setInstructions.language"
            />
            {languageError && (
              <Text testID="set-instructions.language.error" style={styles.errorText}>
                Please select a language
              </Text>
            )}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <CategoryChips
              categories={categories}
              selected={selectedCategory}
              onSelect={onCategorySelect}
              variant="overlay"
              testIDPrefix="setInstructions.category"
            />
            {categoriesError && (
              <View style={styles.categoryErrorContainer}>
                <Text testID="set-instructions.category.error" style={styles.errorText}>
                  {categoriesError}
                </Text>
                <Button
                  accessibilityLabel="Retry category loading"
                  style={styles.retryButton}
                  thin={true}
                  onPress={onRetryCategories}
                  testID="set-instructions.button.retry-categories"
                >
                  Retry
                </Button>
              </View>
            )}
          </View>
          <InputDescription
            label="Describe the hidden point"
            invalid={false}
            style={styles.input}
            textInputConfig={{
              accessibilityLabel: "Hidden point description",
              placeholder: "How is your hiding location?",
              placeholderTextColor: "white",
              keyboardType: "default",
              onChangeText: inputChangeHandler,
              maxLength: 800,
              multiline: true,
              testID: 'set-instructions.input.description' }}/>
          <View style={styles.buttonContainer}>
            <Button accessibilityLabel="Confirm hidden point description" style={styles.button} thin={true} onPress={submitHandler} testID="set-instructions.button.confirm-description">Confirm ?</Button>
            <Button accessibilityLabel="Cancel hidden point description" style={styles.button} thin={true} onPress={onCancel} testID="set-instructions.button.cancel-description">Cancel</Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    opacity: 0.75
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },
  column: {
    width: "90%",
    alignItems: "stretch",
  },
  field: {
    width: "100%",
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  input: {
    alignItems: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  button: {
    borderRadius: 10,
    marginHorizontal: 10,
  },
  errorText: {
    fontSize: 13,
    color: "#FF8A80",
    marginTop: 4,
  },
  categoryErrorContainer: {
    marginTop: 4,
    alignItems: "flex-start",
  },
  retryButton: {
    marginTop: 8,
  },
})

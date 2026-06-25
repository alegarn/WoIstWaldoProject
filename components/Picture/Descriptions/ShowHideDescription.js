import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Keyboard } from "react-native";
import Button from "../../UI/Button";
import InputDescription from "./InputDescription";
import LanguageSelector from "../../UI/LanguageSelector";
import CategoryChips from "../../UI/CategoryChips";

const STEP_DESCRIBE = 0;
const STEP_LANGUAGE = 1;
const STEP_CATEGORY = 2;

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
  const [step, setStep] = useState(STEP_DESCRIBE);

  const goNext = () => {
    Keyboard.dismiss();
    setStep((current) => Math.min(current + 1, STEP_CATEGORY));
  };

  const goBack = () => {
    Keyboard.dismiss();
    setStep((current) => Math.max(current - 1, STEP_DESCRIBE));
  };

  const languageMissing = step === STEP_LANGUAGE && !language;

  const handleNext = () => {
    if (languageMissing) {
      return;
    }
    goNext();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          {step === STEP_DESCRIBE && (
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
          )}

          {step === STEP_LANGUAGE && (
            <View style={styles.field}>
              <Text style={styles.label}>Language</Text>
              <LanguageSelector
                value={language}
                onChange={onLanguageChange}
                variant="overlay"
                testIDPrefix="setInstructions.language"
              />
              {(languageError || languageMissing) && (
                <Text testID="set-instructions.language.error" style={styles.errorText}>
                  Please select a language
                </Text>
              )}
            </View>
          )}

          {step === STEP_CATEGORY && (
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
          )}

          <View style={styles.buttonContainer}>
            {step > STEP_DESCRIBE && (
              <Button
                accessibilityLabel="Back to previous step"
                mode="flat"
                style={styles.button}
                onPress={goBack}
                testID="set-instructions.button.back"
              >
                Back
              </Button>
            )}
            <Button
              accessibilityLabel="Cancel hidden point description"
              style={styles.button}
              thin={true}
              onPress={onCancel}
              testID="set-instructions.button.cancel-description"
            >
              Cancel
            </Button>
            {step < STEP_CATEGORY && (
              <Button
                accessibilityLabel="Continue to next step"
                style={styles.button}
                thin={true}
                onPress={handleNext}
                testID="set-instructions.button.next"
              >
                Next
              </Button>
            )}
            {step === STEP_CATEGORY && (
              <Button
                accessibilityLabel="Confirm hidden point description"
                style={styles.button}
                thin={true}
                onPress={submitHandler}
                testID="set-instructions.button.confirm-description"
              >
                Confirm ?
              </Button>
            )}
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
    marginTop: 8,
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

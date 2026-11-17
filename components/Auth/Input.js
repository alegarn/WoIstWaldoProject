import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';

import { GlobalStyle, spacing, radius, typography, touchTarget } from '../../constants/theme';

export default function Input({
  label,
  keyboardType,
  secure,
  onUpdateValue,
  value,
  isInvalid,
  error,
  testID,
  accessibilityLabel,
  textContentType,
  autoComplete,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);
  const { t } = useTranslation();

  const showVisibilityToggle = secure;

  return (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, isInvalid && styles.labelInvalid]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          isInvalid && styles.inputInvalid,
        ]}
      >
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={secure || keyboardType === 'email-address' ? false : true}
          keyboardType={keyboardType}
          textContentType={textContentType}
          autoComplete={autoComplete}
          secureTextEntry={secure && !isSecureVisible}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChangeText={onUpdateValue}
          testID={testID}
          value={value}
        />
        {showVisibilityToggle && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isSecureVisible ? t('auth.hidePassword') : t('auth.showPassword')
            }
            onPress={() => setIsSecureVisible((prev) => !prev)}
            style={styles.visibilityToggle}
            hitSlop={8}
          >
            <Ionicons
              name={isSecureVisible ? 'eye-off' : 'eye'}
              size={22}
              color={GlobalStyle.color.primaryColor800}
            />
          </Pressable>
        )}
      </View>
      {isInvalid && error ? (
        <Text
          accessibilityRole="alert"
          style={styles.errorText}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    marginVertical: spacing.sm,
  },
  label: {
    ...typography.label,
    color: 'white',
    marginBottom: spacing.xs,
  },
  labelInvalid: {
    color: GlobalStyle.color.error500,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget.minHeight,
    paddingHorizontal: spacing.md,
    backgroundColor: GlobalStyle.color.secondaryColor,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: 'white',
  },
  inputInvalid: {
    backgroundColor: GlobalStyle.color.error100,
    borderColor: GlobalStyle.color.error500,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    color: GlobalStyle.color.primaryColor900,
  },
  visibilityToggle: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  errorText: {
    ...typography.label,
    fontWeight: '400',
    color: GlobalStyle.color.error500,
    marginTop: spacing.xs,
  },
});

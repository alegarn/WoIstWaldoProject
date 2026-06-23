import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native';

import StarRatingLine from '../UI/StarRatingLine';
import { addImageTag, deleteImageTag, submitRating } from '../../utils/ratingRequests';
import { RATING_DIMENSIONS } from '../../constants/rating';
import { getUserTags, saveUserTag } from '../../utils/storageDatum';

const PAYLOAD_KEY_BY_DIMENSION = {
  quality: 'quality_rating',
  enigma: 'enigma_rating',
  fun: 'fun_rating',
  difficulty: 'difficulty_rating',
};

function normalizeTagName(name) {
  return String(name || '').trim().toLowerCase();
}

export default function RatingSubmissionBlock({ pictureId, context, testIDPrefix = 'result.rating' }) {
  const [globalRating, setGlobalRating] = useState(0);
  const [detailed, setDetailed] = useState(false);
  const [detailRatings, setDetailRatings] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [tagError, setTagError] = useState(null);
  const [addingTag, setAddingTag] = useState(false);
  const [validating, setValidating] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let isActive = true;

    if (!pictureId) {
      return () => {
        isActive = false;
      };
    }

    async function loadUserTags() {
      try {
        const storedTags = await getUserTags();
        if (isActive) {
          setUserTags(storedTags);
        }
      } catch (error) {
        if (isActive) {
          setUserTags([]);
        }
      }
    }

    void loadUserTags();

    return () => {
      isActive = false;
    };
  }, [pictureId]);

  if (!pictureId) {
    return null;
  }

  const canValidate = globalRating > 0 && !validating;
  const normalizedTagInput = normalizeTagName(tagInput);
  const canAddTag = normalizedTagInput.length > 0 && !addingTag;
  // Suggestions are local AsyncStorage strings and expected to stay small in v1,
  // so synchronous filtering is intentional. Add debouncing only if the list grows.
  const filteredSuggestions = normalizedTagInput
    ? userTags.filter(
        (name) =>
          name.includes(normalizedTagInput) &&
          !tags.some((tag) => tag.name === name)
      )
    : [];

  const handleDetailChange = (key, next) => {
    setDetailRatings((prev) => ({ ...prev, [key]: next }));
  };

  const buildPayload = () => {
    const payload = { global_rating: globalRating };
    for (const dim of RATING_DIMENSIONS) {
      const value = detailRatings[dim.key];
      const payloadKey = PAYLOAD_KEY_BY_DIMENSION[dim.key];
      if (value && value > 0) {
        payload[payloadKey] = value;
      }
    }
    return payload;
  };

  const handleValidate = async () => {
    if (!canValidate) {
      return;
    }

    setValidating(true);
    setSubmitError(null);

    const response = await submitRating({
      pictureId,
      context,
      payload: buildPayload(),
    });

    setValidating(false);

    if (response?.isError) {
      setSubmitError(response.message || 'Failed to submit rating');
      return;
    }

    setSubmitted(true);
  };

  const handleAddTag = async (rawName = tagInput) => {
    const normalizedName = normalizeTagName(rawName);

    if (!normalizedName || addingTag || tags.some((tag) => tag.name === normalizedName)) {
      return;
    }

    setAddingTag(true);
    setTagError(null);

    try {
      const response = await addImageTag({
        pictureId,
        context,
        name: normalizedName,
      });

      if (response?.isError) {
        setTagError(response.message || 'Failed to add tag');
        return;
      }

      const nextUserTags = await saveUserTag(normalizedName);
      setUserTags(Array.isArray(nextUserTags) ? nextUserTags : userTags);
      setTags((prev) => [
        ...prev,
        {
          id: response?.data?.id || normalizedName,
          name: normalizeTagName(response?.data?.name || normalizedName),
        },
      ]);
      setTagInput('');
    } catch (error) {
      setTagError(error?.message || 'Failed to add tag');
    } finally {
      setAddingTag(false);
    }
  };

  const handleRemoveTag = async (tag) => {
    setTagError(null);

    if (!tag?.id) {
      setTags((prev) => prev.filter((currentTag) => currentTag.name !== tag.name));
      return;
    }

    try {
      const response = await deleteImageTag({
        pictureId,
        context,
        id: tag.id,
      });

      if (response?.isError) {
        setTagError(response.message || 'Failed to remove tag');
        return;
      }

      setTags((prev) => prev.filter((currentTag) => currentTag.name !== tag.name));
    } catch (error) {
      setTagError(error?.message || 'Failed to remove tag');
    }
  };

  if (submitted) {
    return (
      <View testID={`${testIDPrefix}.success`} style={styles.container}>
        <Text style={styles.sectionTitle}>Thanks for your rating!</Text>
      </View>
    );
  }

  return (
    <View testID={`${testIDPrefix}.block`} style={styles.container}>
      <Text style={styles.sectionTitle}>Global rating</Text>
      <StarRatingLine
        value={globalRating}
        onChange={setGlobalRating}
        testIDPrefix={`${testIDPrefix}.global`}
      />

      <Pressable
        testID={`${testIDPrefix}.toggle-details`}
        onPress={() => setDetailed((v) => !v)}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>
          {detailed ? 'Hide details' : 'Rate in details'}
        </Text>
      </Pressable>

      {detailed &&
        RATING_DIMENSIONS.map((dim) => (
          <View key={dim.key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{dim.label}</Text>
            <StarRatingLine
              value={detailRatings[dim.key] || 0}
              onChange={(next) => handleDetailChange(dim.key, next)}
              testIDPrefix={`${testIDPrefix}.detail.${dim.key}`}
            />
          </View>
        ))}

      <View style={styles.tagsSection}>
        <Text style={styles.detailLabel}>Tags</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            testID={`${testIDPrefix}.tags.input`}
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={() => {
              void handleAddTag();
            }}
            placeholder="Add a tag"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.tagInput}
          />
          <Pressable
            testID={`${testIDPrefix}.tags.add`}
            onPress={() => {
              void handleAddTag();
            }}
            disabled={!canAddTag}
            style={[styles.addTagButton, !canAddTag && styles.validateDisabled]}
          >
            <Text style={styles.addTagButtonText}>Add</Text>
          </Pressable>
        </View>

        {filteredSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {filteredSuggestions.map((name) => (
              <Pressable
                key={name}
                testID={`${testIDPrefix}.tags.suggestion.${encodeURIComponent(name)}`}
                onPress={() => setTagInput(name)}
                style={styles.suggestionChip}
              >
                <Text style={styles.suggestionText}>{name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {tags.map((tag) => (
              <Pressable
                key={tag.id}
                testID={`${testIDPrefix}.tags.chip.${encodeURIComponent(tag.name)}`}
                onPress={() => {
                  void handleRemoveTag(tag);
                }}
                style={styles.tagChip}
              >
                <Text style={styles.tagChipText}>{tag.name} ×</Text>
              </Pressable>
            ))}
          </View>
        )}

        {tagError && (
          <Text testID={`${testIDPrefix}.tags.error`} style={styles.errorText}>
            {tagError}
          </Text>
        )}
      </View>

      <Pressable
        testID={`${testIDPrefix}.validate`}
        onPress={handleValidate}
        disabled={!canValidate}
        style={[styles.validate, !canValidate && styles.validateDisabled]}
      >
        {validating ? (
          <ActivityIndicator testID={`${testIDPrefix}.validating`} />
        ) : (
          <Text style={styles.validateText}>Validate</Text>
        )}
      </Pressable>

      {submitError && (
        <Text testID={`${testIDPrefix}.error`} style={styles.errorText}>
          {submitError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1D133D',
  },
  toggle: {
    marginTop: 12,
    padding: 8,
  },
  toggleText: {
    fontSize: 14,
    color: '#1D133D',
  },
  detailRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  tagsSection: {
    width: '100%',
    marginTop: 16,
  },
  tagInputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1D133D',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1D133D',
    backgroundColor: '#FFFFFF',
  },
  addTagButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1D133D',
  },
  addTagButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  suggestionChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1ECFF',
  },
  suggestionText: {
    color: '#1D133D',
    fontSize: 13,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  tagChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1D133D',
  },
  tagChipText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  detailLabel: {
    fontSize: 14,
    marginBottom: 4,
    color: '#1D133D',
  },
  validate: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1D133D',
    borderRadius: 8,
  },
  validateDisabled: {
    opacity: 0.4,
  },
  validateText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#B00020',
  },
});

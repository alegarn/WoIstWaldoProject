import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';

import StarRatingLine from '../UI/StarRatingLine';
import CenteredModal from '../UI/CenteredModal';
import { addImageTag, deleteImageTag, submitRating } from '../../utils/ratingRequests';
import { RATING_DIMENSIONS } from '../../constants/rating';
import { getUserTags, saveUserTag } from '../../utils/storageDatum';

const PAYLOAD_KEY_BY_DIMENSION = {
  quality: 'quality_rating',
  enigma: 'enigma_rating',
  fun: 'fun_rating',
  difficulty: 'difficulty_rating',
};

const AUTO_SUBMIT_DEBOUNCE_MS = 700;

function normalizeTagName(name) {
  return String(name || '').trim().toLowerCase();
}

function buildDetailPayloadSnippet(detailRatings) {
  const snippet = {};
  for (const dim of RATING_DIMENSIONS) {
    const value = detailRatings[dim.key];
    const payloadKey = PAYLOAD_KEY_BY_DIMENSION[dim.key];
    if (value && value > 0) {
      snippet[payloadKey] = value;
    }
  }
  return snippet;
}

export default function RatingSubmissionBlock({
  pictureId,
  context,
  testIDPrefix = 'result.rating',
  onSubmitted,
}) {
  const [phase, setPhase] = useState('rating');
  const [globalRating, setGlobalRating] = useState(0);
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailRatings, setDetailRatings] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [tagError, setTagError] = useState(null);
  const [addingTag, setAddingTag] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const debounceTimerRef = useRef(null);
  const hasAutoSubmittedRef = useRef(false);
  const globalRatingRef = useRef(0);

  useEffect(() => {
    globalRatingRef.current = globalRating;
  }, [globalRating]);

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
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [pictureId]);

  if (!pictureId) {
    return null;
  }

  const clearDebounce = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const runAutoSubmit = async (ratingValue) => {
    if (hasAutoSubmittedRef.current) {
      return;
    }
    hasAutoSubmittedRef.current = true;

    setSubmitError(null);

    const response = await submitRating({
      pictureId,
      context,
      payload: { global_rating: ratingValue },
    });

    if (response?.isError) {
      hasAutoSubmittedRef.current = false;
      setSubmitError(response.message || 'Failed to submit rating');
      return;
    }

    setPhase('submitted');
    onSubmitted?.();
  };

  const handleGlobalChange = (next) => {
    setGlobalRating(next);

    if (next > 0) {
      clearDebounce();
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void runAutoSubmit(next);
      }, AUTO_SUBMIT_DEBOUNCE_MS);
    } else {
      clearDebounce();
    }
  };

  const handleDetailChange = (key, next) => {
    setDetailRatings((prev) => ({ ...prev, [key]: next }));
  };

  const handleSaveDetails = async () => {
    if (savingDetails) {
      return;
    }

    setSavingDetails(true);
    setSubmitError(null);

    const payload = {
      global_rating: globalRatingRef.current || globalRating,
      ...buildDetailPayloadSnippet(detailRatings),
    };

    const response = await submitRating({ pictureId, context, payload });

    setSavingDetails(false);

    if (response?.isError) {
      setSubmitError(response.message || 'Failed to submit rating');
      return;
    }

    setDetailsModalOpen(false);
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

  if (phase === 'rating') {
    return (
      <View testID={`${testIDPrefix}.block`} style={styles.container}>
        <StarRatingLine
          value={globalRating}
          onChange={handleGlobalChange}
          testIDPrefix={`${testIDPrefix}.global`}
          starSize={48}
          widthPercent={90}
        />

        {submitError && (
          <Text testID={`${testIDPrefix}.error`} style={styles.errorText}>
            {submitError}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View testID={`${testIDPrefix}.block`} style={styles.container}>
      <View style={styles.linksRow}>
        <Pressable
          testID={`${testIDPrefix}.tags.link`}
          onPress={() => setTagsModalOpen(true)}
          style={styles.link}
        >
          <Text style={styles.linkText}>Add tags (optional)</Text>
        </Pressable>
        <Pressable
          testID={`${testIDPrefix}.details.link`}
          onPress={() => setDetailsModalOpen(true)}
          style={styles.link}
        >
          <Text style={styles.linkText}>Add details (optional)</Text>
        </Pressable>
      </View>

      <CenteredModal
        isModalVisible={tagsModalOpen}
        onCancel={() => setTagsModalOpen(false)}
        onPress={() => setTagsModalOpen(false)}
        testIDPrefix={`${testIDPrefix}.tags.modal`}
      >
        <View style={styles.tagsSection}>
          <Text style={styles.detailModalTitle}>Tags</Text>
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
      </CenteredModal>

      <CenteredModal
        isModalVisible={detailsModalOpen}
        onCancel={() => setDetailsModalOpen(false)}
        onPress={() => setDetailsModalOpen(false)}
        testIDPrefix={`${testIDPrefix}.details.modal`}
      >
        <View style={styles.detailModalBody}>
          <View style={styles.detailModalHeader}>
            <Text style={styles.detailModalTitle}>Rate in details</Text>
            <View style={styles.detailModalDivider} />
          </View>
          <View style={styles.detailRowsContainer}>
            {RATING_DIMENSIONS.map((dim) => (
              <View key={dim.key} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{dim.label}</Text>
                <StarRatingLine
                  value={detailRatings[dim.key] || 0}
                  onChange={(next) => handleDetailChange(dim.key, next)}
                  testIDPrefix={`${testIDPrefix}.detail.${dim.key}`}
                  widthPercent={60}
                  hideLabel
                />
              </View>
            ))}
          </View>
          <Pressable
            testID={`${testIDPrefix}.details.save`}
            onPress={handleSaveDetails}
            disabled={savingDetails}
            style={[styles.validate, savingDetails && styles.validateDisabled]}
          >
            <Text style={styles.validateText}>Save</Text>
          </Pressable>
        </View>
      </CenteredModal>
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
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  link: {
    padding: 4,
  },
  linkText: {
    fontSize: 14,
    color: '#6B6480',
  },
  detailRow: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F6F2FF',
    width: '100%',
  },
  detailModalBody: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
  },
  detailModalHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    backgroundColor: '#1D133D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  detailModalDivider: {
    width: '60%',
    height: 2,
    backgroundColor: '#1D133D',
    marginTop: 12,
    borderRadius: 2,
  },
  detailRowsContainer: {
    width: '100%',
    marginTop: 8,
  },
  tagsSection: {
    width: '100%',
    alignItems: 'center',
  },
  tagInputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
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

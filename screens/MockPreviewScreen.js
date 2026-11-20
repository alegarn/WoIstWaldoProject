import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';

import StarRatingLine from '../components/UI/StarRatingLine';
import StarRatingBadge from '../components/UI/StarRatingBadge';
import GuessCategoryCard from '../components/UI/GuessCategoryCard';
import BadgeDetailModal from '../components/UI/BadgeDetailModal';
import LanguageSelector from '../components/UI/LanguageSelector';
import CategoryChips from '../components/UI/CategoryChips';

import { GlobalStyle } from '../constants/theme';
import { MOCK_CATEGORIES } from '../data/mock-categories';
import { MOCK_RATINGS } from '../data/mock-ratings';
import { MOCK_IMAGE_DETAILS } from '../data/mock-image-detail';
import { RATING_DIMENSIONS } from '../constants/rating';

const PREVIEW_CATEGORIES = MOCK_CATEGORIES.filter((category) => category.key !== 'all');

export default function MockPreviewScreen() {
  const [ratingValue, setRatingValue] = useState(0);
  const [badgeIndex, setBadgeIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [subRatings, setSubRatings] = useState({});
  const [detailSparse, setDetailSparse] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [language, setLanguage] = useState('en');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const currentBadge = MOCK_RATINGS[badgeIndex];
  const currentDetail = detailVisible
    ? MOCK_IMAGE_DETAILS[detailSparse ? 'sparse' : 'full']
    : null;

  const cycleBadgeIndex = () => {
    setBadgeIndex((previous) => (previous + 1) % MOCK_RATINGS.length);
  };

  const updateSubRating = (key, next) => {
    setSubRatings((previous) => ({ ...previous, [key]: next }));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Mock Preview</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>StarRatingLine (global)</Text>
        <StarRatingLine
          value={ratingValue}
          onChange={setRatingValue}
          testIDPrefix="preview.global"
        />
        <View style={styles.buttonRow}>
          {[0, 1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={`rating-${value}`}
              testID={`preview.global.set.${value}`}
              onPress={() => setRatingValue(value)}
              style={styles.button}>
              <Text style={styles.buttonText}>{value}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>StarRatingBadge</Text>
        <StarRatingBadge
          value={currentBadge.average}
          ratingsCount={currentBadge.count}
          testIDPrefix="preview.badge"
        />
        <Pressable
          testID="preview.badge.cycle"
          onPress={cycleBadgeIndex}
          style={styles.button}>
          <Text style={styles.buttonText}>Cycle badge ({badgeIndex + 1}/{MOCK_RATINGS.length})</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detailed rating</Text>
        <Pressable
          testID="preview.detail.toggle"
          onPress={() => setShowDetails((previous) => !previous)}
          style={styles.button}>
          <Text style={styles.buttonText}>
            {showDetails ? 'Hide details' : 'Show details'}
          </Text>
        </Pressable>
        {showDetails &&
          RATING_DIMENSIONS.map((dimension) => (
            <View key={dimension.key} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{dimension.label}</Text>
              <StarRatingLine
                value={subRatings[dimension.key] || 0}
                onChange={(next) => updateSubRating(dimension.key, next)}
                testIDPrefix={`preview.detail.${dimension.key}`}
                widthPercent={70}
              />
            </View>
          ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GuessCategoryCard</Text>
        <View style={styles.cardRow}>
          {PREVIEW_CATEGORIES.slice(0, 3).map((category) => (
            <View key={category.id} style={styles.cardWrapper}>
              <GuessCategoryCard
                category={category}
                thumbnailUrl={category.thumbnailUrl}
                count={category.count}
                onPress={() => console.log('card press', category.key)}
                testIDPrefix="preview.card"
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CategoryChips</Text>
        <CategoryChips
          categories={MOCK_CATEGORIES}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          testIDPrefix="preview.chips"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LanguageSelector</Text>
        <LanguageSelector
          value={language}
          onChange={setLanguage}
          testIDPrefix="preview.lang"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BadgeDetailModal</Text>
        <View style={styles.buttonRow}>
          <Pressable
            testID="preview.modal.open"
            onPress={() => setDetailVisible(true)}
            style={styles.button}>
            <Text style={styles.buttonText}>Open detail modal</Text>
          </Pressable>
          <Pressable
            testID="preview.modal.toggleSparse"
            onPress={() => setDetailSparse((previous) => !previous)}
            style={styles.button}>
            <Text style={styles.buttonText}>
              {detailSparse ? 'Sparse' : 'Full'}
            </Text>
          </Pressable>
        </View>
      </View>

      <BadgeDetailModal
        image={currentDetail}
        onClose={() => setDetailVisible(false)}
        onOpenFilter={() => console.log('filter open')}
        testIDPrefix="badge.detail"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'GlobalStyle.color.tertiaryColor900',
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F6F6F8',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'GlobalStyle.color.tertiaryColor900',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'GlobalStyle.color.tertiaryColor900',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  detailRow: {
    marginTop: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardWrapper: {
    width: 100,
  },
});

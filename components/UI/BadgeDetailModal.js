import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => (typeof tag === 'string' ? tag : tag?.name))
      .filter(Boolean);
  }

  if (typeof tags === 'string' && tags.trim()) {
    return [tags.trim()];
  }

  return [];
}

function formatCreatedAt(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function BadgeDetailModal({ image, onClose, onOpenFilter, testIDPrefix }) {
  const tags = normalizeTags(image?.tags);
  const category = image?.category?.name ?? image?.category;
  const language = image?.language;
  const creator = image?.creatorUsername ?? image?.creator_username;
  const createdAt = formatCreatedAt(image?.createdAt ?? image?.created_at);
  const fullDescription = image?.fullDescription ?? image?.full_description;

  return (
    <Modal visible={!!image} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View testID={`${testIDPrefix}.modal`} style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onOpenFilter} testID={`${testIDPrefix}.filter`} style={styles.filterButton}>
            <Text style={styles.filterText}>⚙ Filter</Text>
          </Pressable>
          <Pressable onPress={onClose} testID={`${testIDPrefix}.close`} style={styles.closeButton}>
            <Text style={styles.closeText}>X</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.separator} />

          {tags.length > 0 && (
            <View style={styles.row} testID={`${testIDPrefix}.row.tags`}>
              <Text style={styles.label}>Tags</Text>
              <Text style={styles.value}>{tags.join(', ')}</Text>
            </View>
          )}

          {category ? (
            <View style={styles.row} testID={`${testIDPrefix}.row.category`}>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.value}>{category}</Text>
            </View>
          ) : null}

          {language ? (
            <View style={styles.row} testID={`${testIDPrefix}.row.language`}>
              <Text style={styles.label}>Language</Text>
              <Text style={styles.value}>{language}</Text>
            </View>
          ) : null}

          {creator ? (
            <View style={styles.row} testID={`${testIDPrefix}.row.creator`}>
              <Text style={styles.label}>Creator</Text>
              <Text style={styles.value}>{creator}</Text>
            </View>
          ) : null}

          {createdAt ? (
            <View style={styles.row} testID={`${testIDPrefix}.row.date`}>
              <Text style={styles.label}>Created</Text>
              <Text style={styles.value}>{createdAt}</Text>
            </View>
          ) : null}

          {fullDescription ? (
            <View style={styles.row} testID={`${testIDPrefix}.row.enigma`}>
              <Text style={styles.label}>Enigma</Text>
              <Text style={styles.value}>{fullDescription}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterButton: {
    padding: 8,
  },
  filterText: {
    fontSize: 16,
    color: '#1D133D',
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1D133D',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#CCCCCC',
    marginVertical: 8,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEEEE',
  },
  label: {
    fontSize: 12,
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    color: '#1D133D',
  },
});

import { Modal, View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity } from 'react-native';

export default function BadgeDetailModal({ image, onClose, onOpenFilter, testIDPrefix }) {
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

          {image?.tags !== undefined && (
            <View style={styles.row} testID={`${testIDPrefix}.row.tags`}>
              <Text style={styles.label}>Tags</Text>
              <Text style={styles.value}>
                {Array.isArray(image.tags) ? image.tags.join(', ') : ''}
              </Text>
            </View>
          )}

          {image?.category !== undefined && (
            <View style={styles.row} testID={`${testIDPrefix}.row.category`}>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.value}>{image?.category?.name}</Text>
            </View>
          )}

          {image?.language !== undefined && (
            <View style={styles.row} testID={`${testIDPrefix}.row.language`}>
              <Text style={styles.label}>Language</Text>
              <Text style={styles.value}>{image?.language}</Text>
            </View>
          )}

          {image?.creator_username !== undefined && (
            <View style={styles.row} testID={`${testIDPrefix}.row.creator`}>
              <Text style={styles.label}>Creator</Text>
              <Text style={styles.value}>{image?.creator_username}</Text>
            </View>
          )}

          {image?.created_at !== undefined && (
            <View style={styles.row} testID={`${testIDPrefix}.row.date`}>
              <Text style={styles.label}>Created</Text>
              <Text style={styles.value}>{image?.created_at}</Text>
            </View>
          )}

          {image?.full_description !== undefined && (
            <View style={styles.row} testID={`${testIDPrefix}.row.enigma`}>
              <Text style={styles.label}>Enigma</Text>
              <Text style={styles.value}>{image?.full_description}</Text>
            </View>
          )}
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

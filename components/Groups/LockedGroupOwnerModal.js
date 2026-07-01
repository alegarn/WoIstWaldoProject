import { Modal, View, Text, StyleSheet } from 'react-native';

import Button from '../UI/Button';

export default function LockedGroupOwnerModal({
  visible,
  groupName,
  onRenew,
  onTransfer,
  onDismiss,
  testIDPrefix = 'private-home.locked-owner-modal',
}) {
  const name = groupName && groupName.trim().length > 0 ? groupName : 'this group';

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.backdrop} testID={`${testIDPrefix}.backdrop`}>
        <View
          accessibilityLabel={`${testIDPrefix} content`}
          style={styles.content}
          testID={`${testIDPrefix}.content`}
        >
          <Text style={styles.title} testID={`${testIDPrefix}.title`}>
            Your Premium+ subscription ended
          </Text>
          <Text style={styles.body}>
            {`${name} is now locked and read-only. Members can still view existing images and rankings, but new private games are paused until you renew your Premium+ subscription or transfer ownership to an active Premium+ member.`}
          </Text>

          <View style={styles.actions}>
            <Button
              onPress={onRenew}
              testID={`${testIDPrefix}.button.renew`}
              accessibilityLabel="Renew subscription"
            >
              Renew subscription
            </Button>
            <Button
              mode="flat"
              onPress={onTransfer}
              testID={`${testIDPrefix}.button.transfer`}
              accessibilityLabel="Transfer ownership"
            >
              Transfer ownership
            </Button>
            <Button
              mode="flat"
              cancel
              onPress={onDismiss}
              testID={`${testIDPrefix}.button.dismiss`}
              accessibilityLabel="Later"
            >
              Later
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    maxWidth: '85%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  actions: {
    width: '100%',
    gap: 8,
  },
});

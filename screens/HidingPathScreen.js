import { useState } from 'react';
import {  View } from 'react-native';
import LogicalImagePicker from '../components/Picture/LogicalImagePicker';

export default function HidingPathScreen() {

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <LogicalImagePicker />
    </View>
  );
};

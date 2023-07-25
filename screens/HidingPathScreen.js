import { useState } from 'react';
import {  View } from 'react-native';
import ImagePicker from '../components/Picture/ImagePicker';

export default function HidingPathScreen() {

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ImagePicker />
    </View>
  );
};

import React from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRAND } from '../config/brand';

const logoSource = require('../../assets/logo/app_logo.png');
const { width, height } = Dimensions.get('window');

export function BrandLoadingScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoFrame}>
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.colors.black,
  },
  logoFrame: {
    width: Math.min(width * 0.78, 360),
    height: Math.min(height * 0.34, 320),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});

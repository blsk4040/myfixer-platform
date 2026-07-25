import React from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRAND } from '../config/brand';

const logoSource = require('../../assets/logo/trans.png');

export function BrandLoadingScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const logoWidth = Math.min(width * 0.84, 420);
  const logoHeight = Math.min(height * 0.62, 640);

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.logoFrame, { width: logoWidth, height: logoHeight }]}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});

import React from 'react';
import { View, StyleSheet, Image, ImageBackground } from 'react-native';
import { Utils,TopBar,TYSdk } from 'tuya-panel-kit';
import { useSelector } from '@models';
import HomeMainView from './home-main-view';
import HomeBottomView from './home-bottom-view';
import DpCodes from '../../config/dpCodes';
import Res from '../../res';

const { convertX: cx } = Utils.RatioUtils;
const { powerCode } = DpCodes;

const Home: React.FC = () => {
  const power = useSelector(state => state.dpState[powerCode]);

  return (
    <ImageBackground source={Res.bg} style={styles.bg}>
      <TopBar
        background="transparent"
        title={TYSdk.devInfo.name}
        color="white"
        actions={[
          {
            name: 'pen',
            color: 'white',
            onPress: () => TYSdk.native.showDeviceMenu(),
          },
        ]}
        onBack={TYSdk.mobile.back}
      />
      <View style={{ flex: 1 }}>
        <View style={styles.content}>
          {power ? (
            <HomeMainView />
          ) : (
            <Image style={styles.image} source={Res.themeImage} resizeMode="contain" />
          )}
        </View>
        <HomeBottomView />
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  image: {
    width: cx(200),
    height: cx(200),
    opacity: 0.8,
  },
  bg: {
    width: cx(375),
    flex: 1,
  },
});

export default Home;

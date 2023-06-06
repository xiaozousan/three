import throttle from 'lodash/throttle';
import React, { useCallback, useRef, useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { Utils, TYSdk, TYText } from 'tuya-panel-kit';
import Res from '@res';
import { useSelector } from '@models';
import { lampPutDpData } from '@api';
import _ from 'lodash';
import color from 'color';
import { ColorParser, calcPosition } from '../../../utils';
import SupportUtils from '../../../utils/support';
import TempCirclePicker from '../../../components/TempCirclePicker';
import SliderView from '../../../components/SliderView';
import icons from '../../../res/iconfont';
import DpCodes from '../../../config/dpCodes';
import Button from '../../../components/Button';

const { powerCode, countdownCode, autoCode, readCode } = DpCodes;
const { convertX: cx, convertY: cy } = Utils.RatioUtils;
const { isSupportTemp, isSupportBright, isSupportCountdown } = SupportUtils;
const { withTheme } = Utils.ThemeUtils;
const {
  brightCode,
  temperatureCode: tempCode,
  controlCode: controlDataCode,
  workModeCode,
} = DpCodes;
const TYDevice = TYSdk.device;

const LED_SIZE = Math.min(150, cx(150));
const TEMP_RADIUS = Math.min(cy(135), cx(135));
const TEMP_INNER_RADIUS = Math.min(cy(110), cx(110));
const THUMB_SIZE = Math.min(cy(50), cx(50));

const mapTempToKelvin = (v: number) => {
  const kelvin = calcPosition(2500, 9000, v / 1000);
  return kelvin;
};

const calcHSV = (tempValue: number, bright: number) => {
  const kelvin = mapTempToKelvin(tempValue);
  const rgb = Utils.ColorUtils.color.kelvin2rgb(kelvin);
  const [h, s] = Utils.ColorUtils.color.rgb2hsb(...rgb);
  return [h, s, bright / 10];
};

const renderThumb = () => {
  return <Image style={{ width: THUMB_SIZE, height: THUMB_SIZE }} source={Res.thumbBg} />;
};
interface MainWhiteViewProps {
  theme?: any;
}

const MainWhiteView: React.FC<MainWhiteViewProps> = ({
  theme: {
    global: { themeColor, fontColor },
  },
}) => {
  const power = useSelector(state => state.dpState[powerCode]);
  const read = useSelector(state => state.dpState[readCode]);
  const auto = useSelector(state => state.dpState[autoCode]);
  const isSupportWhiteTemp = useRef(isSupportTemp());
  const isSupportWhiteBright = useRef(isSupportBright());
  const circleRef = useRef<View>(null);
  const tempBgRef = useRef<Image>(null);
  const temperature = useSelector(state => state.dpState[tempCode]) as number;
  const brightness = useSelector(state => state.dpState[brightCode]) as number;

  const [brightDpMin] = useState(_.get(TYDevice.getDpSchema(brightCode), 'min') || 10);
  const [brightDpMax] = useState(_.get(TYDevice.getDpSchema(brightCode), 'max') || 1000);
  const _handleTogglePower = useCallback(
    throttle(() => {
      lampPutDpData({ [powerCode]: !power });
    }, 200),
    [power]
  );
  const getStops = useCallback(() => {
    const warmStart = {
      offset: '0%',
      stopColor: '#FFCA5C',
      stopOpacity: 1,
    };
    const coldStart = {
      offset: '0%',
      stopColor: '#C0E8FF',
      stopOpacity: 1,
    };
    const warmEnd = { ...warmStart, offset: '100%' };
    const coldEnd = { ...coldStart, offset: '100%' };
    if (isSupportWhiteTemp.current) {
      return [warmStart, coldEnd];
    }
    return [warmStart, warmEnd];
  }, [isSupportWhiteTemp.current]);

  // 下发调节dp
  const putControlDataDP = throttle((brightValue: number, tempValue: number) => {
    if (!controlDataCode) {
      return;
    }
    const encodeControlData = ColorParser.encodeControlData(
      1, // m
      0, // h
      0, // s
      0, // v
      brightValue,
      tempValue || 0
    );
    lampPutDpData({
      [controlDataCode]: encodeControlData,
    });
  }, 150);

  const handleBrightChange = (brightValue: number) => {
    const newBrightValue = Math.round(brightValue);
    updatePreview(newBrightValue, temperature);
    putControlDataDP(newBrightValue, temperature);
  };

  const handleTempChange = (tempValue: number) => {
    updatePreview(brightness, tempValue);
    putControlDataDP(brightness, tempValue);
  };

  const handleTempComplete = (tempValue: number) => {
    if (typeof putControlDataDP.cancel === 'function') {
      putControlDataDP.cancel();
    }
    updatePreview(brightness, tempValue);
    lampPutDpData({
      [workModeCode]: 'white',
      [tempCode]: tempValue,
    });
  };

  const handleBrightnessComplete = brightValue => {
    if (typeof putControlDataDP.cancel === 'function') {
      putControlDataDP.cancel();
    }
    updatePreview(brightValue, temperature);
    lampPutDpData({
      [workModeCode]: 'white',
      [brightCode]: Math.round(brightValue),
    });
  };

  const updatePreview = throttle((brightValue: number, tempValue: number) => {
    const previewTemp = tempValue || 0;
    const hsv = calcHSV(previewTemp, brightValue);
    const backgroundColor = ColorParser.hsv2rgba(hsv[0], hsv[1] * 10, hsv[2] * 10);
    if (circleRef && circleRef.current) {
      circleRef.current.setNativeProps({
        style: {
          backgroundColor,
        },
      });
    }
    if (!isSupportWhiteTemp.current && tempBgRef && tempBgRef.current) {
      tempBgRef.current.setNativeProps({
        style: {
          tintColor: backgroundColor,
        },
      });
    }
  }, 50);

  const renderTrack = useCallback(() => {
    let previewTemp = 0;
    let img = Res.warmBg;
    if (isSupportWhiteTemp.current) {
      img = Res.tempBg;
      previewTemp = temperature;
    }
    const hsv = calcHSV(previewTemp, brightness);
    const backgroundColor = ColorParser.hsv2rgba(hsv[0], hsv[1] * 10, hsv[2] * 10);
    return (
      <Image
        ref={tempBgRef}
        style={[
          { width: TEMP_RADIUS * 2, height: TEMP_RADIUS * 2 },
          !isSupportWhiteTemp.current && {
            tintColor: backgroundColor,
          },
        ]}
        source={img}
      />
    );
  }, [brightness]);

  const getBackgroundColor = useCallback(() => {
    const hsv = calcHSV(temperature || 0, brightness);
    return ColorParser.hsv2rgba(hsv[0], hsv[1] * 10, hsv[2] * 10);
  }, [temperature, brightness]);
  // three
  const _handleToggleAuto = useCallback(
    throttle(() => {
      lampPutDpData({ [autoCode]: !auto });
    }, 200),
    [auto]
  );
  const _handleToggleRead = useCallback(
    throttle(() => {
      lampPutDpData({ [readCode]: !read });
    }, 200),
    [read]
  );

  // three
  return (
    <View style={styles.container}>
      <View style={styles.displayView}>
        <TempCirclePicker
          value={temperature}
          outerRadius={TEMP_RADIUS}
          innerRadius={TEMP_INNER_RADIUS}
          offsetAngle={40}
          thumbSize={THUMB_SIZE}
          disabled={!isSupportWhiteTemp.current}
          showThumb={isSupportWhiteTemp.current}
          stopColors={getStops()}
          thumbStyle={styles.thumbStyle}
          renderThumb={renderThumb}
          renderTrack={renderTrack}
          onMove={handleTempChange}
          onRelease={handleTempComplete}
        />
        <View style={[styles.led, { backgroundColor: getBackgroundColor() }]} ref={circleRef}>
          <Image source={Res.led} style={{ width: cx(28), height: cx(39) }} />
        </View>
      </View>
      <View style={styles.controlView}>
        {isSupportWhiteBright.current && (
          <SliderView
            accessibilityLabel="HomeScene_WhiteView_Brightness"
            theme={{ fontColor }}
            icon={icons.brightness}
            min={brightDpMin}
            max={brightDpMax}
            percentStartPoint={1}
            value={brightness}
            onValueChange={handleBrightChange}
            onSlidingComplete={handleBrightnessComplete}
          />
        )}
      </View>
      <View style={styles.btnViewbox}>
        {/* <Button
          accessibilityLabel="HomeScene_BottomView_Power"
          style={styles.btnView}
          size={cx(28)}
          icon={icons.power}
          iconColor={power ? fontColor : themeColor}
          iconStyle={[
            styles.icon,
            { backgroundColor: power ? themeColor : color(themeColor).alpha(0.1).rgbString() },
          ]}
          onPress={_handleToggleAuto}
        />
        <Button
          accessibilityLabel="HomeScene_BottomView_Power"
          style={styles.btnView}
          size={cx(28)}
          icon={icons.power}
          iconColor={power ? fontColor : themeColor}
          iconStyle={[
            styles.icon,
            { backgroundColor: power ? themeColor : color(themeColor).alpha(0.1).rgbString() },
          ]}
          onPress={_handleToggleRead}
        /> */}
        <TouchableOpacity
          style={[styles.button, auto && styles.buttonact, !auto && styles.buttonact2]}
          accessibilityLabel="HomeScene_BottomView_Power"
          onPress={_handleToggleAuto}
        >
          <Image
            source={Res.iconAuto}
            style={{ width: cx(25), height: cx(30), tintColor: '#132157' }}
          />
          <TYText style={[styles.buttonText, !auto && styles.buttonText2]}>自动模式</TYText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, read && styles.buttonact, !read && styles.buttonact2]}
          accessibilityLabel="HomeScene_BottomView_Power"
          onPress={_handleToggleRead}
        >
          <Image source={Res.iconRead} style={{ width: cx(25), height: cx(30) }} />
          <TYText style={[styles.buttonText, !auto && styles.buttonText2]}>阅读模式</TYText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: cy(40),
  },

  displayView: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnViewbox: {
    width: cx(375),
    alignItems: 'center',
    flexDirection: 'row',
    // justifyContent: 'space-between',
    justifyContent: 'space-evenly',
  },
  // btnView: {
  //   // flex: 1,
  //   alignItems: 'center',
  //   flexDirection: 'row',
  //   justifyContent: 'flex-start',
  // },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: cx(110),
    height: cx(50),
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  buttonact: {
    backgroundColor: 'white',
  },
  buttonact2: {
    borderWidth: cx(1),
    borderColor: '#4d5d8e',
  },
  buttonText: {
    color: '#525c84',
    fontSize: 16,
  },
  buttonText2: {
    color: '#475685',
    fontSize: 16,
  },
  // icon: {
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   width: cx(54),
  //   height: cx(54),
  //   borderRadius: cx(27),
  // },
  controlView: {
    height: cy(120),
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    marginTop: cy(15),
  },

  led: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: LED_SIZE,
    height: LED_SIZE,
    borderRadius: LED_SIZE * 0.5,
    backgroundColor: 'transparent',
  },
  thumbStyle: {
    backgroundColor: 'transparent',
  },
});

export default withTheme(MainWhiteView);

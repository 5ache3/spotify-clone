import { Dimensions, Platform, StatusBar } from 'react-native';

// android
const android = Platform.OS === 'android';

const iOS = Platform.OS === 'ios';
const web = Platform.OS === 'web';
const windowInfo = Dimensions.get('window');
const { height, width } = windowInfo;
const aspectRatio = height / width;

// is iPad
const { isPad } = Platform;

// is iPhone with Notch?
// iPhoneX, iPhoneXs, iPhoneXr, iPhoneXs Max, iPhone 11 & 12
let iPhoneNotch = false;
if (iOS) {
  // iphone screen breakdown
  // https://blog.calebnance.com/development/iphone-ipad-pixel-sizes-guide-complete-list.html
  if (height >= 812) {
    iPhoneNotch = true;
  }
}

// tall android status bars (punch-hole cameras) need the same extra space
if (android && StatusBar.currentHeight > 28) {
  iPhoneNotch = true;
}

export default {
  android,
  aspectRatio,
  height,
  iOS,
  iPhoneNotch,
  isPad,
  web,
  width
};

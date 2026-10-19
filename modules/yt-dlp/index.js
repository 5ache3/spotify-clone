import { requireOptionalNativeModule } from 'expo';

// null on iOS, web and Expo Go: the app then uses the computer server
const YtDlp = requireOptionalNativeModule('YtDlp');

export default YtDlp;

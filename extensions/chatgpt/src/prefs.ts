import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  accessToken: string;
  puid: string;
  model?: string;
}

const prefs = getPreferenceValues<Preferences>();

export default prefs;

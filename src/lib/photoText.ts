/** The upload's few sentences, written once so the form's hint and its
 *  client-side checks say the same thing as the endpoint. Client-safe. */

import { MAX_PHOTO_MB } from "./limits";
import { MIN_PHOTO_EDGE } from "./photoNames.js";

export const PHOTO_HINT = `JPEG, PNG eller WebP, minst ${MIN_PHOTO_EDGE} pixlar på långsidan.`;
export const PHOTO_PICK = "Välj en bild.";
export const PHOTO_TOO_BIG = `Bilden är för stor – max ${MAX_PHOTO_MB} MB.`;

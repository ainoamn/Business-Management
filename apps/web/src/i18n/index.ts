import { ar } from './ar';
import { en } from './en';
import type { Locale } from '@work/shared-types';
export const translations = {ar,en};
export function dictionary(locale:Locale) {return translations[locale];}

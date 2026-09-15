export const GENDERS = ['Male', 'Female', 'Other'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_ICONS: Record<string, string> = {
  'Male': '👨',
  'Female': '👩',
  'Other': '🌈'
};

// Relative times and numbers are formatted with next-intl's useFormatter / getFormatter
// so they follow the active language.
export const placeLabel = (city: string, area?: string | null) =>
  area ? `${area}, ${city}` : city;

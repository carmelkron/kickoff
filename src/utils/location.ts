export function normalizeLocationText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function stripCountrySuffix(value: string) {
  return value
    .replace(/,\s*Israel$/i, '')
    .replace(/,\s*ישראל$/u, '')
    .trim();
}

export function formatLocationLabel(address: string, city: string) {
  const normalizedAddress = normalizeLocationText(address);
  const normalizedCity = normalizeLocationText(city);

  if (!normalizedAddress) return normalizedCity;
  if (!normalizedCity) return normalizedAddress;

  if (normalizedAddress.toLocaleLowerCase().includes(normalizedCity.toLocaleLowerCase())) {
    return normalizedAddress;
  }

  return `${normalizedAddress}, ${normalizedCity}`;
}

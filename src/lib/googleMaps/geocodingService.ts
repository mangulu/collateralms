/// <reference types="@types/google.maps" />
declare const google: typeof globalThis.google;

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  isValid: boolean;
  placeId?: string;
  addressComponents?: google.maps.GeocoderAddressComponent[];
}

export interface AddressValidationResult {
  geocoded: GeocodeResult | null;
  matchScore: number;
  matchType: 'EXACT' | 'PARTIAL' | 'MISMATCH';
  sameRegion: boolean;
  flagged: boolean;
  error?: string;
}

/**
 * Geocode a single address string using Google Maps Geocoding API.
 * Returns lat/lng, formatted address, and validity.
 */
export async function geocodeAddress(
  address: string,
  geocoder: google.maps.Geocoder
): Promise<GeocodeResult> {
  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
        const result = results[0];
        resolve({
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
          formattedAddress: result.formatted_address,
          isValid: true,
          placeId: result.place_id,
          addressComponents: result.address_components,
        });
      } else {
        resolve({
          lat: 0,
          lng: 0,
          formattedAddress: address,
          isValid: false,
        });
      }
    });
  });
}

/**
 * Batch geocode multiple addresses.
 * Returns a map of address → GeocodeResult.
 */
export async function batchGeocodeAddresses(
  addresses: string[],
  geocoder: google.maps.Geocoder
): Promise<Map<string, GeocodeResult>> {
  const results = new Map<string, GeocodeResult>();
  // Geocode sequentially to respect rate limits
  for (const address of addresses) {
    const result = await geocodeAddress(address, geocoder);
    results.set(address, result);
    // Small delay to avoid hitting rate limits
    await new Promise((r) => setTimeout(r, 100));
  }
  return results;
}

/**
 * Extract the administrative region (state/region) from geocoder address components.
 */
export function extractRegion(
  components: google.maps.GeocoderAddressComponent[] | undefined
): string {
  if (!components) return '';
  const regionComponent = components.find((c) =>
    c.types.includes('administrative_area_level_1')
  );
  return regionComponent?.long_name ?? '';
}

/**
 * Validate two addresses by geocoding both and comparing regions.
 * Returns a match score, match type, and flagged status.
 */
export async function validateAddressPair(
  idAddress: string,
  collateralAddress: string,
  geocoder: google.maps.Geocoder
): Promise<AddressValidationResult> {
  try {
    const [idResult, collateralResult] = await Promise.all([
      geocodeAddress(idAddress, geocoder),
      geocodeAddress(collateralAddress, geocoder),
    ]);

    if (!idResult.isValid || !collateralResult.isValid) {
      return {
        geocoded: collateralResult.isValid ? collateralResult : null,
        matchScore: 0,
        matchType: 'MISMATCH',
        sameRegion: false,
        flagged: true,
        error: 'One or both addresses could not be geocoded',
      };
    }

    const idRegion = extractRegion(idResult.addressComponents);
    const collateralRegion = extractRegion(collateralResult.addressComponents);
    const sameRegion =
      idRegion !== '' && collateralRegion !== '' && idRegion === collateralRegion;

    // Calculate distance between the two geocoded points (in km)
    const distanceKm = haversineDistance(
      idResult.lat,
      idResult.lng,
      collateralResult.lat,
      collateralResult.lng
    );

    // Score: 100 if same place (<1km), 70-99 if same region, lower otherwise
    let matchScore: number;
    let matchType: 'EXACT' | 'PARTIAL' | 'MISMATCH';

    if (distanceKm < 1) {
      matchScore = 95 + Math.round(Math.random() * 5); // 95-100
      matchType = 'EXACT';
    } else if (sameRegion) {
      matchScore = Math.max(50, Math.round(80 - distanceKm * 0.5));
      matchType = 'PARTIAL';
    } else {
      matchScore = Math.max(5, Math.round(30 - distanceKm * 0.1));
      matchType = 'MISMATCH';
    }

    const flagged = matchType === 'MISMATCH' || (!sameRegion && matchScore < 50);

    return {
      geocoded: collateralResult,
      matchScore,
      matchType,
      sameRegion,
      flagged,
    };
  } catch (error) {
    return {
      geocoded: null,
      matchScore: 0,
      matchType: 'MISMATCH',
      sameRegion: false,
      flagged: true,
      error: 'Validation failed',
    };
  }
}

/**
 * Haversine formula to calculate distance between two lat/lng points in km.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

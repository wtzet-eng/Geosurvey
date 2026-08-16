import { shapeAreaM2, shapeCenter, boundaryText, ShapeObj } from "./geoUtils";

export interface GenerateSiteReportParams {
  shape: ShapeObj | null;
  areaSize: number;
  country: string;
  countryCode: string;
  language: string;
  currency: string;
}

export async function generateSiteReport({
  shape,
  areaSize,
  country,
  countryCode,
  language,
  currency,
}: GenerateSiteReportParams) {
  const center = shapeCenter(shape) || [52.2297, 21.0122];
  const areaM2 = shapeAreaM2(shape, areaSize);
  const boundaryDesc = boundaryText(shape, areaM2) || `an area of approximately ${areaM2} m²`;

  const response = await fetch("/api/generate-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lat: center[0],
      lng: center[1],
      boundaryDesc,
      shape,
      areaSize: Math.round(areaM2),
      country,
      countryCode,
      language,
      currency,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to generate report from server.");
  }

  const result = await response.json();
  return result;
}

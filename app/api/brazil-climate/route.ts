import { NextResponse } from "next/server";
import { BRAZIL_CLIMATE_PROVIDERS } from "@/services/climate/registry";

/** Índice da camada modular /api/brazil-climate */
export function GET() {
  return NextResponse.json({
    status: "ok",
    providers: BRAZIL_CLIMATE_PROVIDERS,
    endpoints: {
      cities: "/api/brazil-climate/cities?q=campinas",
      forecast: "/api/brazil-climate/forecast?city=244",
      capitals: "/api/brazil-climate/capitals",
      historical: "/api/brazil-climate/historical?lat=-22.9&lon=-47.06&start=2026-01-01&end=2026-09-30&params=T2M,PRECTOTCORR&anomaly=1"
    }
  });
}

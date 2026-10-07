import "server-only";
/** Chave NASA lida somente no servidor. Sem chave → DEMO_KEY (limites reduzidos). */
export const nasaKey = () => process.env.NASA_API_KEY || "DEMO_KEY";
export const usingDemoKey = () => !process.env.NASA_API_KEY;

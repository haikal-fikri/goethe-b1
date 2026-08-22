import "server-only";
import config from "@payload-config";
import { getPayload, type Payload } from "payload";

/**
 * Zugang zur Local API. `getPayload` hält die Instanz pro Config selbst im
 * Cache — die Funktion ist also billig und kann in jeder Seite aufgerufen
 * werden.
 *
 * Das Frontend liest ausschließlich hierüber; kein `fetch` auf die eigene
 * REST-Schnittstelle (kein HTTP-Umweg beim statischen Erzeugen).
 */
export function getPayloadClient(): Promise<Payload> {
  return getPayload({ config });
}

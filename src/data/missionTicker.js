/**
 * INSPEXO — Trust Ticker mock missions
 * 20 missions simulées pour le bandeau live (Section 03).
 * À remplacer par un flux Supabase realtime en production.
 */

export const missionTicker = [
  { time: "14:23", action: "INSPECTION", brand: "BMW",      model: "SÉRIE 3",      city: "TOULOUSE",    status: "VALIDÉE" },
  { time: "14:18", action: "VISIO",      brand: "AUDI",     model: "A4 AVANT",     city: "BORDEAUX",    status: "EN COURS" },
  { time: "14:11", action: "ANALYSE IA", brand: "MERCEDES", model: "CLASSE E",     city: "LYON",        status: "RAPPORT ENVOYÉ" },
  { time: "14:04", action: "INSPECTION", brand: "PORSCHE",  model: "911 CARRERA",  city: "PARIS",       status: "VALIDÉE" },
  { time: "13:58", action: "VISIO",      brand: "PEUGEOT",  model: "508",          city: "MARSEILLE",   status: "VALIDÉE" },
  { time: "13:46", action: "ANALYSE IA", brand: "RENAULT",  model: "MÉGANE IV",    city: "LILLE",       status: "RAPPORT ENVOYÉ" },
  { time: "13:39", action: "INSPECTION", brand: "VW",       model: "GOLF GTI",     city: "NANTES",      status: "EN COURS" },
  { time: "13:31", action: "VISIO",      brand: "TESLA",    model: "MODEL 3",      city: "MONTPELLIER", status: "VALIDÉE" },
  { time: "13:22", action: "INSPECTION", brand: "BMW",      model: "M3 F80",       city: "TOULOUSE",    status: "RAPPORT ENVOYÉ" },
  { time: "13:15", action: "ANALYSE IA", brand: "AUDI",     model: "Q5 TDI",       city: "BORDEAUX",    status: "VALIDÉE" },
  { time: "13:07", action: "INSPECTION", brand: "MERCEDES", model: "GLC 220D",     city: "LYON",        status: "VALIDÉE" },
  { time: "12:54", action: "ANALYSE IA", brand: "RENAULT",  model: "CAPTUR",       city: "PARIS",       status: "RAPPORT ENVOYÉ" },
  { time: "12:48", action: "VISIO",      brand: "PEUGEOT",  model: "3008",         city: "MARSEILLE",   status: "VALIDÉE" },
  { time: "12:39", action: "INSPECTION", brand: "VW",       model: "TIGUAN",       city: "LILLE",       status: "EN COURS" },
  { time: "12:31", action: "ANALYSE IA", brand: "TESLA",    model: "MODEL Y",      city: "NANTES",      status: "VALIDÉE" },
  { time: "12:22", action: "INSPECTION", brand: "PORSCHE",  model: "CAYENNE",      city: "MONTPELLIER", status: "RAPPORT ENVOYÉ" },
  { time: "12:15", action: "VISIO",      brand: "BMW",      model: "X5 30D",       city: "TOULOUSE",    status: "VALIDÉE" },
  { time: "12:08", action: "ANALYSE IA", brand: "AUDI",     model: "RS6 AVANT",    city: "BORDEAUX",    status: "RAPPORT ENVOYÉ" },
  { time: "11:54", action: "INSPECTION", brand: "MERCEDES", model: "AMG GT 53",    city: "PARIS",       status: "VALIDÉE" },
  { time: "11:47", action: "VISIO",      brand: "PEUGEOT",  model: "208 GT-LINE",  city: "MARSEILLE",   status: "VALIDÉE" },
]

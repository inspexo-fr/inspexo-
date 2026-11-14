// SPRINT 1.5 — Admin des fiches famille moteur.
// GET    : liste des fiches (?statut=generee|validee)
// PATCH  : { id, statut: "validee" } — relecture humaine (passe la fiche en
//          « base Inspexo ») ; accepte aussi { id, pannes } pour corriger la
//          liste avant validation.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { coutUtilisable, sourcesPortentLEntree } from "../_shared/atlasSource.ts";
import { montantPresent, sanitizePannes } from "../_shared/defectSheets.ts";
import { fusionnerPlan } from "../_shared/planEntretien.ts";
import { couvertureValide } from "../_shared/couverture.ts";
import { fusionnerPrisesEnCharge } from "../_shared/prisesEnCharge.ts";
import { verifierAdmin } from "../_shared/adminAuth.ts";
import { decisionVariante, varianteVehicule } from "../_shared/variantes.ts";
import TABLE_FAMILLES from "../_shared/famillesMoteur.json" with { type: "json" };
import { texteDeLaPageComplet } from "../_shared/verifSource.ts";
import { sourcesPortantes, sourcesToutesEtrangeres, titreSansRappelOfficiel } from "../_shared/rappelsApplicables.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Rôle admin vérifié en base (table admins) — sprint 3.1.
    const acces = await verifierAdmin(req);
    if (!acces.ok) {
      return new Response(JSON.stringify({ error: acces.error }), { status: acces.status, headers: cors });
    }
    const user = acces.user;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const statut = url.searchParams.get("statut");
      let query = admin.from("defect_sheets").select("*").order("created_at", { ascending: false }).limit(100);
      if (statut === "generee" || statut === "validee") query = query.eq("statut", statut);
      const { data, error } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ sheets: data }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      const body = await req.json().catch(() => null);
      if (!body?.id) {
        return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: cors });
      }
      const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.statut === "validee") {
        fields.statut = "validee";
        fields.validee_par = user.email;
        fields.validee_at = new Date().toISOString();
      }
      if (Array.isArray(body.pannes)) {
        // Règle d'or maintenue à la correction manuelle : URL obligatoire,
        // familles étrangères rejetées, champs typés/bornés.
        const { data: row } = await admin
          .from("defect_sheets")
          .select("famille_moteur, marque, pannes")
          .eq("id", body.id)
          .maybeSingle();
        if (!row) {
          return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 404, headers: cors });
        }
        // Les titres déjà enregistrés sont exemptés du contrôle de rang : on
        // corrige une fiche existante, on n'introduit pas une affirmation.
        const titresExistants = (Array.isArray(row.pannes) ? row.pannes : [])
          .map((p: { titre?: unknown }) => String(p?.titre ?? ""))
          .filter(Boolean);
        const { pannes: cleaned } = sanitizePannes(
          body.pannes, row.famille_moteur, row.marque, titresExistants,
        );
        if (cleaned.length !== body.pannes.length) {
          return new Response(
            JSON.stringify({
              error: "pannes invalides",
              detail: `${body.pannes.length - cleaned.length} panne(s) rejetée(s) : URL source manquante, champs invalides ou famille moteur étrangère.`,
            }),
            { status: 400, headers: cors },
          );
        }
        fields.pannes = cleaned;
      }
      // ── AJOUT DE SOURCES À DES PANNES EXISTANTES ──────────────────────
      //
      // C'est le chemin d'écriture de la campagne de re-sourcing : elle ne fait
      // qu'AJOUTER des sources à des pannes déjà là. Aucune suppression, aucun
      // titre nouveau, aucune gravité touchée.
      //
      // ⚠️ Il n'emprunte PAS le chemin `pannes` ci-dessus, et c'est voulu :
      // réécrire la liste entière pour ajouter une URL donnerait à une
      // opération additive le pouvoir de tout remplacer — et il suffirait d'un
      // corps de requête tronqué pour vider une fiche. Ici, une panne absente
      // du corps est une panne qu'on ne touche pas.
      if (Array.isArray(body.ajouter_sources)) {
        const { data: row } = await admin
          .from("defect_sheets").select("pannes").eq("id", body.id).maybeSingle();
        if (!row) {
          return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        }
        const pannes = (Array.isArray(row.pannes) ? row.pannes : []) as Array<Record<string, unknown>>;
        const parTitre = new Map<string, Record<string, unknown>>();
        for (const p of pannes) parTitre.set(String(p?.titre ?? "").trim().toLowerCase(), p);
        let touchees = 0, ajoutees = 0;
        const inconnues: string[] = [];
        for (const ajout of body.ajouter_sources.slice(0, 40)) {
          const cle = String(ajout?.panne_titre ?? "").trim().toLowerCase();
          const panne = parTitre.get(cle);
          if (!panne) { inconnues.push(String(ajout?.panne_titre ?? "").slice(0, 120)); continue; }
          const existantes = Array.isArray(panne.sources) ? panne.sources as Array<{ url?: unknown }> : [];
          const vues = new Set(existantes.map((x) => String(x?.url ?? "")));
          const neuves = (Array.isArray(ajout?.sources) ? ajout.sources : [])
            .filter((x: { url?: unknown }) => typeof x?.url === "string" && /^https:\/\/\S{8,500}$/i.test(x.url))
            // Une source ajoutée doit PORTER : la campagne n'a aucune raison
            // d'enrichir une panne d'un forum de plus.
            .filter((x: { url: string }) => sourcesPortentLEntree([x.url]) && !vues.has(x.url))
            .slice(0, 4)
            .map((x: { url: string; title?: unknown }) => ({
              url: x.url,
              title: typeof x.title === "string" ? x.title.slice(0, 150) : null,
            }));
          if (neuves.length === 0) continue;
          panne.sources = [...existantes, ...neuves].slice(0, 8);
          touchees++; ajoutees += neuves.length;
        }
        if (touchees === 0) {
          return new Response(
            JSON.stringify({ error: "aucune source ajoutable", inconnues }),
            { status: 400, headers: cors },
          );
        }
        fields.pannes = pannes;
        const { error: e2 } = await admin.from("defect_sheets").update(fields).eq("id", body.id);
        if (e2) return new Response(JSON.stringify({ error: e2.message }), { status: 500, headers: cors });
        return new Response(
          JSON.stringify({ pannes_touchees: touchees, sources_ajoutees: ajoutees, inconnues }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // ── SPRINT 24, campagne 2 — INSCRIRE LA REVÉRIFICATION D'UNE PRISE ───
      // Ajoute (ou remplace) le champ `verification` d'une prise désignée par
      // son texte EXACT. Rien d'autre ne bouge ; aucune prise n'est retirée.
      if (Array.isArray(body.verifier_prises)) {
        const { data: row } = await admin.from("defect_sheets").select("prises_en_charge").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const liste = (Array.isArray(row.prises_en_charge) ? row.prises_en_charge : []) as Array<Record<string, unknown>>;
        const avant = JSON.parse(JSON.stringify(liste));
        const marquees: string[] = [], introuvables: string[] = [];
        for (const v of body.verifier_prises.slice(0, 60)) {
          const texte = String(v?.texte ?? "").replace(/\s+/g, " ").trim();
          const x = liste.find((p) => String(p?.texte ?? "").replace(/\s+/g, " ").trim() === texte);
          if (!x || !["a_jour", "a_reverifier"].includes(v?.statut) || !/^\d{4}-\d{2}-\d{2}$/.test(String(v?.le ?? ""))) { introuvables.push(texte.slice(0, 80)); continue; }
          x.verification = { statut: v.statut, le: String(v.le), motif: v.motif ? String(v.motif).slice(0, 200) : null };
          marquees.push(texte.slice(0, 80));
        }
        if (marquees.length === 0) return new Response(JSON.stringify({ error: "aucune prise marquée", introuvables }), { status: 400, headers: cors });
        const { error: e12 } = await admin.from("defect_sheets").update({ ...fields, prises_en_charge: liste }).eq("id", body.id);
        if (e12) return new Response(JSON.stringify({ error: e12.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ marquees: marquees.length, introuvables, prises_avant: avant }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // ── SPRINT 24 — CORRIGER UNE PRISE (décisions d'Utku du 14 nov. 2026) ─
      //   masquer       : plus aucune source portante ⇒ masquée PARTOUT,
      //                   jamais supprimée (`masquee`, motif daté) ;
      //   restreindre   : limitée aux véhicules que la page source NOMME ;
      //   ajouter_source: une autre source PORTANTE, jugée, rejoint ses URL.
      // Prise désignée par son texte EXACT. Les prises d'avant sont rendues.
      if (Array.isArray(body.corriger_prises)) {
        const { data: row } = await admin.from("defect_sheets").select("prises_en_charge").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const liste = (Array.isArray(row.prises_en_charge) ? row.prises_en_charge : []) as Array<Record<string, unknown>>;
        const avant = JSON.parse(JSON.stringify(liste));
        const faites: string[] = [], refus: Array<{ texte: string; motif: string }> = [];
        const le = new Date().toISOString().slice(0, 10);
        for (const c of body.corriger_prises.slice(0, 20)) {
          const texte = String(c?.texte ?? "").replace(/\s+/g, " ").trim();
          const x = liste.find((p) => String(p?.texte ?? "").replace(/\s+/g, " ").trim() === texte);
          if (!x) { refus.push({ texte: texte.slice(0, 80), motif: "introuvable" }); continue; }
          if (c?.action === "masquer") {
            x.masquee = { le, motif: String(c?.motif ?? "plus de source portante").slice(0, 200) };
          } else if (c?.action === "restreindre") {
            const v = (Array.isArray(c?.vehicules) ? c.vehicules : []).filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 1).map((t: string) => t.trim().slice(0, 60)).slice(0, 8);
            if (!v.length) { refus.push({ texte: texte.slice(0, 80), motif: "aucun véhicule" }); continue; }
            x.restreinte_a = v;
          } else if (c?.action === "ajouter_source") {
            const url = String(c?.url ?? "");
            if (!/^https:\/\/\S{8,500}$/i.test(url) || !sourcesPortentLEntree([url])) { refus.push({ texte: texte.slice(0, 80), motif: "source non portante" }); continue; }
            const urls = Array.isArray(x.urls) ? x.urls as string[] : [];
            if (!urls.includes(url)) x.urls = [...urls, url].slice(0, 4);
          } else { refus.push({ texte: texte.slice(0, 80), motif: "action inconnue" }); continue; }
          faites.push(`${c.action} : ${texte.slice(0, 60)}`);
        }
        if (faites.length === 0) return new Response(JSON.stringify({ error: "aucune correction", refus }), { status: 400, headers: cors });
        const { error: e13 } = await admin.from("defect_sheets").update({ ...fields, prises_en_charge: liste }).eq("id", body.id);
        if (e13) return new Response(JSON.stringify({ error: e13.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ faites, refus, prises_avant: avant }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // ── SPRINT 24, campagne 1 — AJOUTER UN COÛT PUBLIÉ À UNE PANNE ──────
      //
      // ADDITIF : une panne qui a DÉJÀ un coût n'est jamais modifiée. Le coût
      // n'entre que si : la page est de rang portant et peut chiffrer
      // (`coutUtilisable`), elle est relue ICI et contient LITTÉRALEMENT les
      // deux montants et l'extrait cité (`montantPresent`). Le juge (2 votes,
      // +1 en cas de désaccord) a validé l'affirmation AVANT, côté campagne ;
      // son verdict est consigné avec la date. Les pannes d'avant sont rendues
      // pour le retour arrière.
      if (Array.isArray(body.ajouter_cout)) {
        const { data: row } = await admin.from("defect_sheets").select("pannes").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const pannes = (Array.isArray(row.pannes) ? row.pannes : []) as Array<Record<string, unknown>>;
        const avant = JSON.parse(JSON.stringify(pannes));
        const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
        const faits: string[] = [];
        const refus: Array<{ titre: string; motif: string }> = [];
        for (const a of body.ajouter_cout.slice(0, 20)) {
          const titre = String(a?.panne_titre ?? "").trim();
          const p = pannes.find((x) => String(x?.titre ?? "").trim() === titre);
          const min = Number(a?.min), max = Number(a?.max);
          const url = String(a?.url ?? "");
          const extrait = String(a?.extrait ?? "").slice(0, 400);
          if (!p) { refus.push({ titre, motif: "panne introuvable" }); continue; }
          if (typeof p.cout_indicatif_eur_min === "number") { refus.push({ titre, motif: "coût déjà présent" }); continue; }
          if (!(min > 0 && max >= min && max < 100000)) { refus.push({ titre, motif: "montants invalides" }); continue; }
          if (!/^https:\/\/\S{8,500}$/i.test(url) || !sourcesPortentLEntree([url]) || !coutUtilisable([url])) { refus.push({ titre, motif: "source non portante" }); continue; }
          if (a?.juge !== "soutenue") { refus.push({ titre, motif: "non validé par le juge" }); continue; }
          const texte = await texteDeLaPageComplet(url, 50).catch(() => null);
          if (!texte) { refus.push({ titre, motif: "page illisible" }); continue; }
          if (!montantPresent(texte, min) || !montantPresent(texte, max)) { refus.push({ titre, motif: "montant absent de la page" }); continue; }
          if (extrait && !norm(texte).includes(norm(extrait).slice(0, 80))) { refus.push({ titre, motif: "extrait absent de la page" }); continue; }
          p.cout_indicatif_eur_min = min;
          p.cout_indicatif_eur_max = max;
          p.cout_source = { url, extrait, verifie_le: new Date().toISOString().slice(0, 10), juge: "soutenue" };
          const urls = Array.isArray(p.url_source) ? p.url_source as string[] : [];
          if (!urls.includes(url)) p.url_source = [...urls, url];
          faits.push(titre);
        }
        if (faits.length === 0) return new Response(JSON.stringify({ error: "aucun coût ajouté", refus }), { status: 400, headers: cors });
        const { error: e11 } = await admin.from("defect_sheets").update({ ...fields, pannes }).eq("id", body.id);
        if (e11) return new Response(JSON.stringify({ error: e11.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ ajoutes: faits, refus, pannes_avant: avant }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // ── SPRINT 24 — RETIRER LES PANNES D'UNE AUTRE VERSION ─────────────
      //
      // Décision d'Utku du 13 nov. 2026 (FIREFLY) : une panne qui nomme une
      // cylindrée ou une puissance DIFFÉRENTE de la famille (règle des
      // variantes, barème 11.17) sort de la fiche. Le serveur décide lui-même
      // lesquelles, par `decisionVariante` contre le nom de la table : seules
      // les pannes « exclue » partent, jamais une « question ». `titres_attendus`
      // est OBLIGATOIRE et doit désigner EXACTEMENT cet ensemble, sinon rien
      // n'est écrit (409). `simuler: true` n'écrit rien. Les pannes retirées
      // sont rendues pour le retour arrière.
      if (body.retirer_autre_version === true) {
        const { data: row } = await admin.from("defect_sheets").select("pannes, marque, famille_moteur").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const norm = (x: unknown) => String(x ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        // deno-lint-ignore no-explicit-any
        const fam = ((TABLE_FAMILLES as any).familles as Array<{ marque: string; famille: string; nom_commercial: string }>)
          .find((f) => norm(f.famille) === norm(row.famille_moteur) && f.marque.toLowerCase() === String(row.marque).toLowerCase());
        if (!fam) return new Response(JSON.stringify({ error: "famille absente de la table" }), { status: 400, headers: cors });
        const version = varianteVehicule({ motorisation: fam.nom_commercial });
        const pannes = (Array.isArray(row.pannes) ? row.pannes : []) as Array<Record<string, unknown>>;
        const exclue = (p: Record<string, unknown>) =>
          decisionVariante(`${p?.titre ?? ""} ${p?.symptomes ?? ""}`, version).statut === "exclue";
        const retirees = pannes.filter(exclue);
        const titres = retirees.map((p) => String(p.titre ?? "").trim()).sort();
        const attendus = (Array.isArray(body.titres_attendus) ? body.titres_attendus : []).map((t: unknown) => String(t).trim()).sort();
        if (retirees.length === 0 || JSON.stringify(titres) !== JSON.stringify(attendus)) {
          return new Response(JSON.stringify({ error: "ensemble différent de celui attendu", a_retirer: titres, version: fam.nom_commercial }), { status: 409, headers: cors });
        }
        if (body.simuler === true) {
          return new Response(JSON.stringify({ simulation: true, a_retirer: titres, restantes: pannes.length - retirees.length }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        const { error: e10 } = await admin.from("defect_sheets").update({ ...fields, pannes: pannes.filter((p) => !exclue(p)) }).eq("id", body.id);
        if (e10) return new Response(JSON.stringify({ error: e10.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ retirees, restantes: pannes.length - retirees.length, version: fam.nom_commercial }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // ── SPRINT 22 — AJOUT D'UN PLAN D'ENTRETIEN SOURCÉ ─────────────────
      //
      // Même philosophie qu'`ajouter_sources` : ADDITIF. `fusionnerPlan`
      // ajoute une opération nouvelle, complète une opération « à vérifier
      // dans le carnet », et ne remplace JAMAIS une opération déjà établie.
      // Le rang des sources est recontrôlé ici : l'écriture ne fait pas
      // confiance à l'appelant, même administrateur.
      //
      // Le plan d'AVANT est renvoyé dans la réponse : le script le garde pour
      // pouvoir revenir en arrière (`restaurer_plan`) dans l'heure du jeton.
      if (Array.isArray(body.ajouter_plan) || Array.isArray(body.restaurer_plan)) {
        const { data: row } = await admin
          .from("defect_sheets").select("plan_entretien").eq("id", body.id).maybeSingle();
        if (!row) {
          return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        }
        const avant = Array.isArray(row.plan_entretien) ? row.plan_entretien : [];
        let plan = avant;
        let bilan: Record<string, unknown> = {};
        if (Array.isArray(body.restaurer_plan)) {
          // Retour arrière : on remet EXACTEMENT ce qui a été renvoyé avant.
          plan = body.restaurer_plan.slice(0, 12);
          bilan = { restaure: true };
        } else {
          const f = fusionnerPlan(avant, body.ajouter_plan);
          if (f.ajoutees + f.completees === 0) {
            return new Response(JSON.stringify({ error: "aucune operation ajoutable", refusees: f.refusees }), { status: 400, headers: cors });
          }
          plan = f.plan;
          bilan = { ajoutees: f.ajoutees, completees: f.completees, refusees: f.refusees };
        }
        const { error: e3 } = await admin.from("defect_sheets")
          .update({ ...fields, plan_entretien: plan }).eq("id", body.id);
        if (e3) return new Response(JSON.stringify({ error: e3.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ ...bilan, plan_avant: avant, plan_apres: plan }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // ── SPRINT 23 — COUVERTURE MULTI-MARQUES ───────────────────────────
      //
      // Remplace la couverture d'une fiche par une liste RELUE (marque,
      // modèle, années). Nettoyée par `couvertureValide` : marques et modèles
      // canonisés, bornes plausibles. La couverture d'avant est renvoyée pour
      // le retour arrière (même jeton). Écrire une couverture CHANGE DES
      // SCORES : c'est le changement (e) de la séquence, jamais en douce.
      // ── SPRINT 23 (f) — AJOUT DE PANNES NOUVELLES (fusion des sources) ───
      //
      // ADDITIF, comme `ajouter_sources` : une panne présente n'est jamais
      // remplacée, une panne absente du corps n'est pas touchée. Chaque panne
      // passe par `sanitizePannes` (règle d'or : source portante, attribution
      // au moteur, gravité jugée sur le remède). Un titre déjà présent est
      // refusé, jamais fusionné en douce.
      if (Array.isArray(body.ajouter_pannes)) {
        const { data: row } = await admin
          .from("defect_sheets").select("pannes, marque, famille_moteur").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const existantes = (Array.isArray(row.pannes) ? row.pannes : []) as Array<{ titre?: string }>;
        const titres = new Set(existantes.map((p) => String(p?.titre ?? "").trim().toLowerCase()));
        const candidates = body.ajouter_pannes.slice(0, 10)
          .filter((p: { titre?: unknown }) => !titres.has(String(p?.titre ?? "").trim().toLowerCase()));
        const { pannes: propres } = sanitizePannes(candidates, row.famille_moteur, row.marque);
        if (propres.length === 0) {
          return new Response(JSON.stringify({ error: "aucune panne ajoutable", rejetees: body.ajouter_pannes.length }), { status: 400, headers: cors });
        }
        const { error: e5 } = await admin.from("defect_sheets")
          .update({ ...fields, pannes: [...existantes, ...propres] }).eq("id", body.id);
        if (e5) return new Response(JSON.stringify({ error: e5.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({
          pannes_ajoutees: propres.length, rejetees: body.ajouter_pannes.length - propres.length,
          titres: propres.map((p) => p.titre),
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // ── SPRINT 23 (f) — RÉÉCRITURE DU RAPPEL D'UNE PANNE (décision de relecture)
      //
      // Une seule panne, nommée par son titre exact. Ses sources sont
      // REMPLACÉES par celles fournies (toutes de rang portant), le code de
      // rappel doit figurer LITTÉRALEMENT sur l'une d'elles (même règle qu'à la
      // génération), et tout le reste de la panne est conservé (gravité
      // arbitrée comprise). La panne d'avant est rendue pour le retour arrière.
      if (body.modifier_rappel && typeof body.modifier_rappel === "object") {
        const m = body.modifier_rappel;
        const { data: row } = await admin.from("defect_sheets").select("pannes").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const pannes = (Array.isArray(row.pannes) ? row.pannes : []) as Array<Record<string, unknown>>;
        const idx = pannes.findIndex((p) => String(p?.titre ?? "").trim() === String(m.panne_titre ?? "").trim());
        if (idx < 0) return new Response(JSON.stringify({ error: "panne introuvable" }), { status: 400, headers: cors });
        const urls = (Array.isArray(m.sources) ? m.sources : [])
          .filter((u: unknown): u is string => typeof u === "string" && /^https:\/\/\S{8,500}$/i.test(u)).slice(0, 4);
        if (urls.length === 0 || !urls.every((u: string) => sourcesPortentLEntree([u]))) {
          return new Response(JSON.stringify({ error: "sources non portantes" }), { status: 400, headers: cors });
        }
        const code = String(m.rappel_code ?? "").trim().slice(0, 40);
        let codeVu = false;
        // Lecture par le lecteur partagé : il refuse les sites d'annonces avant
        // toute requête (promesse « pas de scraping »).
        for (const u of urls) {
          const texte = await texteDeLaPageComplet(u, 50).catch(() => null);
          if (texte && texte.includes(code)) { codeVu = true; break; }
        }
        if (!code || !codeVu) return new Response(JSON.stringify({ error: "code de rappel absent des pages citées" }), { status: 400, headers: cors });
        const an = (n: unknown) => (typeof n === "number" && n > 1980 && n < 2100 ? n : null);
        const avant = pannes[idx];
        pannes[idx] = {
          ...avant,
          sources: urls.map((url: string) => ({ url, title: null })),
          url_source: urls,
          rappel_code: code,
          rappel_date: m.rappel_date ? String(m.rappel_date).slice(0, 40) : null,
          rappel_vehicules: m.rappel_vehicules ? String(m.rappel_vehicules).slice(0, 160) : null,
          rappel_annee_debut: an(m.rappel_annee_debut),
          rappel_annee_fin: an(m.rappel_annee_fin),
          rappel_portee: m.rappel_portee === "mondiale" ? "mondiale" : null,
        };
        const { error: e7 } = await admin.from("defect_sheets").update({ ...fields, pannes }).eq("id", body.id);
        if (e7) return new Response(JSON.stringify({ error: e7.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ modifiee: avant.titre, panne_avant: avant }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // ── SPRINT 23 (point 3) — QUALIFIER UN RAPPEL « ÉTRANGER » ──────────
      // Correction de donnée seulement : la panne, ses sources et son code ne
      // bougent pas. Refusé si une source n'est pas d'un pays CONNU autre que
      // la France : on ne requalifie pas sur une supposition.
      if (body.qualifier_rappel && typeof body.qualifier_rappel === "object") {
        const q = body.qualifier_rappel;
        const { data: row } = await admin.from("defect_sheets").select("pannes").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const pannes = (Array.isArray(row.pannes) ? row.pannes : []) as Array<Record<string, unknown>>;
        const idx = pannes.findIndex((p) =>
          String(p?.titre ?? "").trim() === String(q.panne_titre ?? "").trim() &&
          String(p?.rappel_code ?? "").trim() === String(q.rappel_code ?? "").trim() && Boolean(p?.rappel_code)
        );
        if (idx < 0) return new Response(JSON.stringify({ error: "panne ou code introuvable" }), { status: 400, headers: cors });
        const urls = Array.isArray(pannes[idx].url_source) ? pannes[idx].url_source as unknown[] : [];
        if (q.rappel_portee !== "etranger" || !sourcesToutesEtrangeres(urls).etrangeres || pannes[idx].rappel_portee === "mondiale") {
          return new Response(JSON.stringify({ error: "sources non toutes étrangères" }), { status: 400, headers: cors });
        }
        const avant = pannes[idx];
        pannes[idx] = { ...avant, rappel_portee: "etranger" };
        const { error: e8 } = await admin.from("defect_sheets").update({ ...fields, pannes }).eq("id", body.id);
        if (e8) return new Response(JSON.stringify({ error: e8.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ qualifiee: avant.titre, rappel_code: avant.rappel_code }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // ── SPRINT 23 (point 3) — RETIRER UN RAPPEL SANS SOURCE PORTANTE ────
      // La panne et ses sources restent ; seuls les champs de rappel sont
      // vidés. Refusé si la panne cite au moins une source portante.
      if (body.retirer_rappel && typeof body.retirer_rappel === "object") {
        const q = body.retirer_rappel;
        const { data: row } = await admin.from("defect_sheets").select("pannes").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const pannes = (Array.isArray(row.pannes) ? row.pannes : []) as Array<Record<string, unknown>>;
        const idx = pannes.findIndex((p) =>
          String(p?.titre ?? "").trim() === String(q.panne_titre ?? "").trim() &&
          String(p?.rappel_code ?? "").trim() === String(q.rappel_code ?? "").trim() && Boolean(p?.rappel_code)
        );
        if (idx < 0) return new Response(JSON.stringify({ error: "panne ou code introuvable" }), { status: 400, headers: cors });
        const urls = Array.isArray(pannes[idx].url_source) ? pannes[idx].url_source as unknown[] : [];
        if (sourcesPortantes(urls).length > 0) {
          return new Response(JSON.stringify({ error: "la panne cite une source portante" }), { status: 400, headers: cors });
        }
        const avant = pannes[idx];
        pannes[idx] = {
          ...avant, titre: titreSansRappelOfficiel(avant.titre),
          rappel_code: null, rappel_date: null, rappel_vehicules: null, rappel_portee: null,
          rappel_annee_debut: null, rappel_annee_fin: null,
        };
        const { error: e9 } = await admin.from("defect_sheets").update({ ...fields, pannes }).eq("id", body.id);
        if (e9) return new Response(JSON.stringify({ error: e9.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ retire: avant.rappel_code, panne: pannes[idx].titre }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // ── SPRINT 23 (f) — PRISES EN CHARGE (affichage seulement) ───────────
      // Additif ; URL recontrôlées : seules les sources de rang portant entrent.
      if (Array.isArray(body.ajouter_prises_en_charge)) {
        const { data: row } = await admin
          .from("defect_sheets").select("prises_en_charge").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const ajouts = body.ajouter_prises_en_charge.slice(0, 60).map((x: { urls?: unknown }) => ({
          ...x, urls: (Array.isArray(x?.urls) ? x.urls : []).filter((u: unknown) => typeof u === "string" && sourcesPortentLEntree([u])),
        }));
        const { liste, ajoutees } = fusionnerPrisesEnCharge(row.prises_en_charge ?? [], ajouts);
        const { error: e6 } = await admin.from("defect_sheets")
          .update({ ...fields, prises_en_charge: liste }).eq("id", body.id);
        if (e6) return new Response(JSON.stringify({ error: e6.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ ajoutees, total: liste.length }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (Array.isArray(body.definir_couverture)) {
        const { data: row } = await admin
          .from("defect_sheets").select("couverture").eq("id", body.id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        const propre = couvertureValide(body.definir_couverture);
        const { error: e4 } = await admin.from("defect_sheets")
          .update({ ...fields, couverture: propre }).eq("id", body.id);
        if (e4) return new Response(JSON.stringify({ error: e4.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({
          entrees: propre.length, rejetees: body.definir_couverture.length - propre.length,
          couverture_avant: row.couverture ?? [], couverture_apres: propre,
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (Object.keys(fields).length === 1) {
        return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400, headers: cors });
      }
      const { data, error } = await admin
        .from("defect_sheets")
        .update(fields)
        .eq("id", body.id)
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ sheet: data }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  } catch (err) {
    console.error("admin-defect-sheets error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});

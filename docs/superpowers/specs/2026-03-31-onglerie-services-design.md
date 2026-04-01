# Design : Ajout des services Onglerie

**Date :** 2026-03-31
**Source :** FICHE DE PRIX - ONGLERIE (1).csv

---

## Objectif

Ajouter la catégorie Onglerie avec 7 services et 24 variantes dans la base de données, en enrichissant le schéma avec un champ `additional_cost` pour capturer les coûts matériaux supplémentaires (capsules, accessoires).

---

## Modifications de schéma

### `service_variants` — nouvelle colonne

```sql
ALTER TABLE service_variants
  ADD COLUMN additional_cost NUMERIC(10,2) NOT NULL DEFAULT 0;
```

**Logique des coûts :**
- `cost` = COUT PRODUIT / SERVICE = `Cout Produits ÷ Utilisation`
  (coût réel consommé par prestation)
- `additional_cost` = COUT ADDITIONNEL
  (accessoires : caps, tips, préparations — ex. 8 MAD pour faux ongles/gel)
- Total matière = `cost + additional_cost` (calculé côté frontend)

---

## Données à insérer

### Catégorie

| Nom | Couleur | Sort order |
|-----|---------|------------|
| Onglerie | `bg-rose-100 text-rose-700` | 4 |

### Services et variantes

#### Manucure (3 variantes)
| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Simple | 25 min | 50 | 0.30 | 0 |
| Spa | 35 min | 80 | 1.00 | 0 |
| Russe | 35 min | 200 | 0.50 | 0 |

#### Pédicure (3 variantes)
| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Simple | 25 min | 70 | 0.30 | 0 |
| Spa | 45 min | 100 | 1.00 | 0 |
| Russe / Médicale | 45 min | 250 | 0.50 | 0 |

#### Vernis (4 variantes)
| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Normal OPY | 20 min | 40 | 5.00 | 0 |
| Semi-permanent OULAC | 20 min | 70 | 8.24 | 0 |
| Semi-permanent SEMILAC | 20 min | 90 | 17.78 | 0 |
| Semi-permanent The Gel Bottle | 20 min | 120 | 27.73 | 0 |

#### Faux Ongles / Capsules (4 variantes)
| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| OULAC | 35 min | 80 | 22.86 | 8 |
| SEMILAC | 35 min | 140 | 22.86 | 8 |
| The Gel Bottle | 35 min | 170 | 30.50 | 8 |
| Capsule BIAB | 60 min | 310 | 41.25 | 8 |

#### BIAB (2 variantes)
| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| The Gel Bottle | 60 min | 240 | 27.50 | 0 |
| Renforcement SEMILAC We Care | 60 min | 150 | 18.33 | 0 |

#### Gel (4 variantes)
| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| OULAC | 70 min | 300 | 16.67 | 8 |
| SEMILAC | 70 min | 350 | 19.44 | 8 |
| The Gel Bottle | 70 min | 500 | 25.00 | 8 |
| Acrylique | 70 min | 600 | 22.22 | 8 |

#### Suppléments (4 variantes)
| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Chrome The Gel Bottle | 10 min | 100 | 9.75 | 0 |
| Réparation d'ongle en gel | 5 min | 50 | 9.00 | 0 |
| Capsule collée | 5 min | 10 | 0.25 | 0 |
| French | 12 min | 20 | 4.00 | 0 |

---

## Modifications frontend

### `types.ts` — type `ServiceVariant`
Ajouter `additionalCost: number` au type `ServiceVariant`.

### `modules/services/mappers.ts`
- `toServiceVariant()` : mapper `additional_cost` → `additionalCost`
- `toVariantInsert()` : inclure `additional_cost` dans l'insert

### `lib/database.types.ts`
Pousser la migration Supabase en premier, puis régénérer via `npm run db:types` (ne pas modifier manuellement).

---

## Données NON stockées (calculables)

Ces valeurs du CSV sont dérivées et calculées à la volée :
- `MARGE (%)` = `(prix - cost - additional_cost) / prix × 100`
- `BÉNÉFICE` = `prix - cost - additional_cost`
- `COUT MAIN D'OEUVRE` = `(durée_min / 60) × taux_horaire`
- `BÉNÉFICE NET` = `prix - cost - additional_cost - cout_main_doeuvre`

---

## Plan d'implémentation

### Migration 1 — Schéma
Fichier : `supabase/migrations/20260331100000_add_additional_cost_to_variants.sql`
- `ALTER TABLE service_variants ADD COLUMN additional_cost NUMERIC(10,2) NOT NULL DEFAULT 0`

### Migration 2 — Données
Fichier : `supabase/migrations/20260331100001_seed_onglerie_services.sql`

Stratégie : créer une fonction idempotente `add_onglerie_services(p_salon_id UUID)` qui :
- Vérifie l'existence avant d'insérer (`INSERT ... ON CONFLICT DO NOTHING` sur le nom de catégorie)
- Insère la catégorie + 7 services + 24 variantes pour le salon donné

La migration :
1. Crée la fonction
2. L'appelle pour **chaque salon existant** : `SELECT add_onglerie_services(id) FROM salons`
3. Supprime la catégorie demo `Ongles` + son service `Manucure` de `seed_salon_demo_data`
4. Appelle `add_onglerie_services` dans `seed_salon_demo_data` pour les **nouveaux salons**

### Étapes frontend
3. Mise à jour `types.ts` — ajouter `additionalCost: number` à `ServiceVariant`
4. Mise à jour `modules/services/mappers.ts` — mapper `additional_cost`
5. Pousser migration sur Supabase remote → `npm run db:types` pour régénérer `lib/database.types.ts`

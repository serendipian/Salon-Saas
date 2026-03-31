# Design : Ajout des services Coiffure

**Date :** 2026-03-31
**Source :** FICHE DE PRIX - COIFFURE.csv

---

## Objectif

Remplacer les 3 services demo de la catégorie Coiffure existante (Coupe Femme, Balayage, Brushing) par les 8 vrais services avec 43 variantes issues de la fiche de prix.

---

## Différences vs Onglerie

- **Pas de migration schéma** — `additional_cost` est déjà en place
- La catégorie **Coiffure existe déjà** → `add_coiffure_services()` trouve son ID, ne la recrée pas
- Les 3 services demo sont **soft-deleted** avant l'insertion
- Les appointments demo qui les référençaient sont **mis à jour** vers des services réels équivalents
- `additional_cost = 0` pour tous les services Coiffure (aucun coût accessoire)

---

## Architecture de la migration

Fichier : `supabase/migrations/20260331200000_seed_coiffure_services.sql`

1. Créer `add_coiffure_services(p_salon_id UUID)` — idempotente (guard: vérifie si la variante 'Court' sous un service 'Brushing' actif existe déjà — impossibe dans la démo qui n'avait que 'Brushing simple' et 'Brushing + boucles')
2. Soft-delete des services demo : Coupe Femme, Balayage, Brushing (par nom, sous Coiffure)
3. Insérer 8 services + 43 variantes sous la catégorie Coiffure existante
4. Appliquer pour tous les salons existants : `SELECT add_coiffure_services(id) FROM salons`
5. `CREATE OR REPLACE FUNCTION seed_salon_demo_data` — remplacer les 3 services demo par `PERFORM add_coiffure_services(p_salon_id)`; mettre à jour les appointments demo en conséquence

---

## Données à insérer

### Service 1 : Brushing (6 variantes)

| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Court | 20 min | 30 | 0.00 | 0 |
| Mi-long | 30 min | 40 | 0.00 | 0 |
| Long | 35 min | 50 | 0.00 | 0 |
| Wavy Babyliss | 45 min | 70 | 0.00 | 0 |
| Wavy Invité | 60 min | 150 | 5.00 | 0 |
| Plaques | 20 min | 50 | 0.00 | 0 |

### Service 2 : Coloration (5 variantes)

| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Racine | 50 min | 200 | 52.00 | 0 |
| Normale (à partir de) | 90 min | 250 | 52.00 | 0 |
| Sans ammoniac (à partir de) | 90 min | 250 | 61.00 | 0 |
| Balayage (à partir de) | 180 min | 700 | 34.67 | 0 |
| Ombré (à partir de) | 180 min | 700 | 34.67 | 0 |

> Calculs : Racine = 52/1 = 52.00 ; Balayage = 52/1.5 = 34.67

### Service 3 : Shampoings (4 variantes)

| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| SH Normal | 5 min | 10 | 4.00 | 0 |
| Mask Normal | 5 min | 10 | 6.25 | 0 |
| SHP Spécial | 5 min | 20 | 8.75 | 0 |
| Mask Spécial | 5 min | 20 | 8.75 | 0 |

> Calculs : SH Normal = 200/50 = 4.00 ; Mask Normal = 250/40 = 6.25 ; SHP/Mask Spécial = 350/40 = 8.75

### Service 4 : Coupes (3 variantes)

| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Pointes | 15 min | 40 | 0.00 | 0 |
| Frange | 15 min | 40 | 0.00 | 0 |
| Relooking | 35 min | 120 | 0.00 | 0 |

### Service 5 : Soins Capillaires (7 variantes)

| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Soin K18 | 60 min | 300 | 145.00 | 0 |
| Soin Ker Factor | 60 min | 300 | 66.67 | 0 |
| Soins Antichute (à partir de) | 60 min | 300 | 100.00 | 0 |
| Soins Cadiveau | 60 min | 400 | 90.00 | 0 |
| Soins Aminoplex | 60 min | 400 | 233.33 | 0 |
| Soins Caviar | 60 min | 400 | 233.33 | 0 |
| Soins Plasma | 80 min | 700 | 250.00 | 0 |

> Calculs : K18 = 5800/40 = 145.00 ; Ker Factor = 1000/15 = 66.67 ; Aminoplex/Caviar = 1400/6 = 233.33 ; Plasma = 5000/20 = 250.00

### Service 6 : Lissages Protéines (8 variantes)

| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Cadiveau (à partir de) | 150 min | 900 | 160.00 | 0 |
| Cadiveau BTX (à partir de) | 150 min | 900 | 160.00 | 0 |
| Sorali Therapy (à partir de) | 150 min | 700 | 165.00 | 0 |
| Fit Tanino (à partir de) | 150 min | 800 | 100.00 | 0 |
| Green (à partir de) | 150 min | 900 | 140.00 | 0 |
| Goldery (à partir de) | 150 min | 1200 | 233.33 | 0 |
| Black Diamond Premium (à partir de) | 150 min | 1500 | 200.00 | 0 |
| Racine (à partir de) | 120 min | 500 | 80.00 | 0 |

> Calculs : Cadiveau = 1600/10 = 160.00 ; Sorali = 1650/10 = 165.00 ; Goldery = 3500/15 = 233.33 ; Black Diamond = 3000/15 = 200.00 ; Racine = 1600/20 = 80.00

### Service 7 : Extensions (5 variantes)

| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Mèche par mèche anneaux (par unité) | 180 min | 50 | 17.00 | 0 |
| Bandes adhésives premium (par unité) | 180 min | 70 | 25.00 | 0 |
| Mèche par mèche 6D | 180 min | 20 | 17.00 | 0 |
| Extension clips 100g | 180 min | 1800 | 800.00 | 0 |
| Extension en kératine (par unité) | 180 min | 50 | 18.00 | 0 |

### Service 8 : Coiffures Invitées (5 variantes)

| Variante | Durée | Prix | Cost | Additional |
|----------|-------|------|------|------------|
| Demi chignon (à partir de) | 90 min | 150 | 2.00 | 0 |
| Coiffure invitée (à partir de) | 90 min | 300 | 2.00 | 0 |
| Babyliss (à partir de) | 60 min | 120 | 5.00 | 0 |
| Babyliss Wavy (à partir de) | 60 min | 150 | 5.00 | 0 |
| Demi chignon + location extensions (à partir de) | 120 min | 300 | 0.00 | 0 |

> Dernière variante : coût indéterminé → 0.00 ; durée estimée 120 min

---

## Soft-delete des services demo

Dans `add_coiffure_services`, avant l'insertion :

```sql
UPDATE services
SET deleted_at = now()
WHERE salon_id = p_salon_id
  AND name IN ('Coupe Femme', 'Balayage', 'Brushing')
  AND deleted_at IS NULL
  AND category_id = (
    SELECT id FROM service_categories
    WHERE salon_id = p_salon_id AND name = 'Coiffure' AND deleted_at IS NULL
    LIMIT 1
  );
```

Leurs variants sont automatiquement filtrés par `deleted_at IS NULL` dans les queries frontend.

---

## Mise à jour du seed pour nouveaux salons

Dans `seed_salon_demo_data` (CREATE OR REPLACE) :
- Supprimer les variables `v_svc_coupe`, `v_svc_balayage`, `v_svc_brushing` et leurs INSERTs
- Ajouter `PERFORM add_coiffure_services(p_salon_id)`
- Résoudre `v_svc_brushing_id` et `v_svc_coloration_id` par SELECT pour remplacer les appointments demo :
  - Appointment Amina (Coupe Femme) → Brushing Court (prix 30)
  - Appointment Sarah (Balayage) → Coloration Racine (prix 200)
  - Appointment Fatima (Brushing) → Brushing Long (prix 50)

---

## Données NON stockées (calculables)

- Marge, bénéfice, coût main d'œuvre — dérivés à la volée côté frontend

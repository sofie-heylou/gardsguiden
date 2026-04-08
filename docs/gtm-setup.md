# GTM & GA4 Setup — Gårdsguiden

All `dataLayer.push()` calls are implemented in the codebase. Follow the steps below to wire them up in GTM and GA4.

---

## Events reference

| Event | Properties | Conversion? |
|---|---|---|
| `filter_applied` | `filter_type`, `filter_value` | No |
| `farm_contact` | `contact_type`, `farm_id`, `farm_name`, `farm_county` | **Yes** |
| `farm_card_clicked` | `farm_id`, `farm_name`, `farm_county` | No |
| `near_me_activated` | `radius_km` | No |
| `add_farm_clicked` | — | No |

---

## Step 1 — Data Layer Variables in GTM

Go to **Variables → New → Data Layer Variable** and create one for each:

| Variable name | Data Layer Variable Name |
|---|---|
| `DLV - filter_type` | `filter_type` |
| `DLV - filter_value` | `filter_value` |
| `DLV - contact_type` | `contact_type` |
| `DLV - farm_id` | `farm_id` |
| `DLV - farm_name` | `farm_name` |
| `DLV - farm_county` | `farm_county` |
| `DLV - radius_km` | `radius_km` |

---

## Step 2 — Custom Event Triggers in GTM

Go to **Triggers → New → Custom Event** and create one for each event:

| Trigger name | Event name (exact match) |
|---|---|
| `CE - filter_applied` | `filter_applied` |
| `CE - farm_contact` | `farm_contact` |
| `CE - farm_card_clicked` | `farm_card_clicked` |
| `CE - near_me_activated` | `near_me_activated` |
| `CE - add_farm_clicked` | `add_farm_clicked` |

---

## Step 3 — GA4 Event Tags in GTM

Go to **Tags → New → Google Analytics: GA4 Event**. Use your existing GA4 Configuration tag as the base. Create one tag per event:

### Tag: GA4 - filter_applied
- **Event name:** `filter_applied`
- **Trigger:** `CE - filter_applied`
- **Parameters:**
  - `filter_type` → `{{DLV - filter_type}}`
  - `filter_value` → `{{DLV - filter_value}}`

### Tag: GA4 - farm_contact
- **Event name:** `farm_contact`
- **Trigger:** `CE - farm_contact`
- **Parameters:**
  - `contact_type` → `{{DLV - contact_type}}`
  - `farm_id` → `{{DLV - farm_id}}`
  - `farm_name` → `{{DLV - farm_name}}`
  - `farm_county` → `{{DLV - farm_county}}`

### Tag: GA4 - farm_card_clicked
- **Event name:** `farm_card_clicked`
- **Trigger:** `CE - farm_card_clicked`
- **Parameters:**
  - `farm_id` → `{{DLV - farm_id}}`
  - `farm_name` → `{{DLV - farm_name}}`
  - `farm_county` → `{{DLV - farm_county}}`

### Tag: GA4 - near_me_activated
- **Event name:** `near_me_activated`
- **Trigger:** `CE - near_me_activated`
- **Parameters:**
  - `radius_km` → `{{DLV - radius_km}}`

### Tag: GA4 - add_farm_clicked
- **Event name:** `add_farm_clicked`
- **Trigger:** `CE - add_farm_clicked`
- **No extra parameters needed**

---

## Step 4 — Publish GTM

Click **Submit** in GTM and publish the container version.

---

## Step 5 — GA4: Mark conversions

Go to **GA4 → Admin → Events** and toggle **Mark as conversion** on:

- `farm_contact`

Optionally also mark:
- `add_farm_clicked` (top of farm owner funnel)

---

## Step 6 — GA4: Custom dimensions

Go to **GA4 → Admin → Custom definitions → Create custom dimension**:

| Display name | Scope | Event parameter |
|---|---|---|
| Contact type | Event | `contact_type` |
| Farm county | Event | `farm_county` |
| Filter type | Event | `filter_type` |
| Filter value | Event | `filter_value` |

---

## Step 7 — Validate

1. Open GTM **Preview mode** and load the site
2. Apply a county filter → verify `filter_applied` fires with correct `filter_type: "county"`
3. Apply a product filter → verify `filter_applied` fires with `filter_type: "product"`
4. Click a farm card → verify `farm_card_clicked` fires
5. Open a farm page → click phone/email/website/directions → verify `farm_contact` fires with correct `contact_type`
6. Click "Nära mig" → verify `near_me_activated` fires
7. Check **GA4 DebugView** (Admin → DebugView) to confirm events appear in real time

---

## Suggested reports in GA4

- **Top counties by interest:** Explore → filter by `farm_county`, metric: Event count for `farm_contact`
- **Most effective contact types:** Breakdown `farm_contact` by `contact_type` dimension
- **Filter usage:** `filter_applied` events broken down by `filter_type` and `filter_value`
- **Near me adoption:** `near_me_activated` event count over time

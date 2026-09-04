---
title: "Aggregated Customer Reviews — VoltCore 20V Cordless Drill and Impact Driver"
upstream_id: reviews-voltcore-2411
source_url: https://retailer-review-api.example.com/voltcore/20v
fetched_at: 2026-01-14T09:00:00Z
feed: retailer-reviews
entity_types:
  - Product
  - DefectType
---

# Customer Reviews — VoltCore 20V Cordless Drill (SKU VC-20-DRL) and 20V Impact Driver (SKU VC-20-IMP)

This report aggregates customer reviews for two finished products: the **VoltCore
20V Cordless Drill** (a finished product, SKU VC-20-DRL) and the **VoltCore 20V
Impact Driver** (a finished product, SKU VC-20-IMP). Both finished products are
built from the shared **VC 20V 2.0Ah Battery Pack** component (part VC-BAT-20).

## Negative review cluster — "dies in the cold"

A cluster of **312 negative reviews** (average rating 1.8 of 5) describes the
same defect: the drill's battery **will not hold a charge below freezing** and
the tool becomes unusable in cold weather. This is a **cold-weather battery
failure** defect. Representative verbatim: *"Worked fine in October, useless once
it hit 20 degrees. Battery drops dead in minutes."* The negative reviews spiked
between **November and January**.

The impact driver shows the **same defect**: a cluster of **88 negative reviews**
(average rating 2.1) reports the battery dying in winter — the same cold-weather
battery failure, in the same season.

## Baseline reviews — general praise

A separate cluster of **4,100 positive reviews** (average rating 4.6) praises the
drill's value, power, and grip. These reviews are **not** associated with any
cold-weather battery failure.

## Grip complaint cluster (unrelated to the cold failure)

A third cluster of **140 reviews** (average rating 3.2) complains about the grip
feeling cheap. This is a **cosmetic complaint** that is spread evenly across all
climates and is **not** correlated with cold weather or with battery failure. It
is a separate issue from the cold-weather battery defect and is not part of the
battery root cause.

## Facts

| Property | Value |
| --- | --- |
| Product (drill) | VoltCore 20V Cordless Drill (VC-20-DRL) |
| Product (impact driver) | VoltCore 20V Impact Driver (VC-20-IMP) |
| Shared component | VC 20V 2.0Ah Battery Pack (VC-BAT-20) |
| Cold-failure reviews (drill) | 312, avg 1.8, spike Nov–Jan |
| Cold-failure reviews (impact driver) | 88, avg 2.1, spike Dec–Jan |
| Baseline positive reviews | 4,100, avg 4.6 |
| Grip complaints (unrelated) | 140, avg 3.2, not climate-correlated |

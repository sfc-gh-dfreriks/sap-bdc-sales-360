# L0 — SAP BDC Standard Data Products (raw / bronze)

The **L0 (bronze)** layer is the set of **SAP Business Data Cloud standard data products** for Sales, CRM and Product, shared into Snowflake with **zero copy, no ETL**:

| Domain | SAP BDC Data Product | Key objects |
|---|---|---|
| Sales (SD) | Sales Orders | `SALESORDERS_SALESORDER`, `SALESORDERS_SALESORDERITEM` |
| CRM | Opportunity Management | `CRM_OPPORTUNITY_OPPORTUNITY`, `CRM_OPPORTUNITY_ACTIVITY`, `CRM_OPPORTUNITY_SALES_REP` |
| Master Data | Customer | `CUSTOMER_CUSTOMER` |
| Master Data | Product | `PRODUCT_PRODUCT` (+ description/group/plant/valuation extensions) |

These land and are curated into the **L1** layer `SAP_SALES_360.SAP_BDC_L1` (see `02_l1_curated_tables.sql`). All shaping and ML enrichment happens in **L2** `SAP_SALES_360.SALES_360_L2` (see `03_l2_analytics_dynamic_tables.sql`).

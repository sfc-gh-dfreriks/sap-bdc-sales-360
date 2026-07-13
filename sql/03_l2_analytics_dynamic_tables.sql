-- =====================================================================
-- L2 (gold) — SALES_360_L2 analytics layer
-- Dynamic tables over L1 (sales orders, CRM opportunities/activities/reps,
-- customer & product) plus ML output tables (revenue predictions, attainment
-- predictions, forecast-vs-actual). Requires a warehouse.
-- =====================================================================

create or replace schema SAP_SALES_360.SALES_360_L2 COMMENT='Sales 360 Layer 2 - Consumption/Analytics';

create or replace TABLE SAP_SALES_360.SALES_360_L2.ATTAINMENT_PREDICTIONS (
	FORECAST_VERSION VARIANT,
	MONTH TIMESTAMP_NTZ(9),
	FORECAST FLOAT,
	LOWER_BOUND FLOAT,
	UPPER_BOUND FLOAT
);
create or replace dynamic table SAP_SALES_360.SALES_360_L2.CRM_OPPORTUNITY_ACTIVITY(
	ACTIVITY_ID COMMENT 'Unique identifier for the CRM activity record',
	OPPORTUNITY_ID COMMENT 'Foreign key linking to the associated sales opportunity',
	SAP_CUSTOMER_KEY COMMENT 'SAP Customer number (KUNNR) linked to this activity',
	ACTIVITY_TYPE COMMENT 'Type of activity: Call, Email, Meeting, Task, etc.',
	SUBJECT COMMENT 'Subject line or title of the activity',
	DESCRIPTION COMMENT 'Detailed description or notes about the activity',
	STATUS COMMENT 'Current status of the activity: Open, Completed, Cancelled, etc.',
	PRIORITY COMMENT 'Priority level: High, Medium, Low',
	ACTIVITY_DATE COMMENT 'Date when the activity occurred or is scheduled',
	START_TIME COMMENT 'Start time of the activity',
	END_TIME COMMENT 'End time of the activity',
	DURATION_MINUTES COMMENT 'Duration of the activity in minutes',
	OWNER_ID COMMENT 'ID of the user who owns/created the activity',
	OWNER_NAME COMMENT 'Name of the activity owner',
	ASSIGNED_TO_ID COMMENT 'ID of the user assigned to complete the activity',
	ASSIGNED_TO_NAME COMMENT 'Name of the assigned user',
	CONTACT_ID COMMENT 'ID of the customer contact involved',
	CONTACT_NAME COMMENT 'Name of the customer contact',
	CONTACT_TITLE COMMENT 'Job title of the customer contact',
	OUTCOME COMMENT 'Result or outcome of the activity',
	NEXT_STEPS COMMENT 'Planned follow-up actions after this activity',
	CREATED_DATE COMMENT 'Timestamp when the activity record was created',
	LAST_MODIFIED_DATE COMMENT 'Timestamp of the last modification',
	IS_DELETED COMMENT 'Flag indicating if the record is soft-deleted',
	CALL_DIRECTION COMMENT 'Direction of call: Inbound or Outbound',
	CALL_DISPOSITION COMMENT 'Outcome of the call: Connected, Left Voicemail, No Answer, etc.',
	MEETING_TYPE COMMENT 'Type of meeting: In-Person, Virtual, Phone, etc.',
	MEETING_LOCATION COMMENT 'Physical or virtual location of the meeting',
	EMAIL_TEMPLATE COMMENT 'Email template used for the communication',
	EMAIL_OPENED COMMENT 'Flag indicating if the email was opened by recipient',
	EMAIL_CLICKED COMMENT 'Flag indicating if links in the email were clicked'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.CRM_OPPORTUNITY_ACTIVITY;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.CRM_OPPORTUNITY_OPPORTUNITY(
	ID COMMENT 'Unique identifier for the sales opportunity (Salesforce ID)',
	NAME COMMENT 'Name or title of the sales opportunity',
	ACCOUNT_ID COMMENT 'Salesforce Account ID for the customer',
	SAP_CUSTOMER_KEY COMMENT 'SAP Customer number (KUNNR) linked to this opportunity',
	DESCRIPTION COMMENT 'Detailed description of the opportunity',
	STAGE_NAME COMMENT 'Current stage in the sales pipeline',
	PROBABILITY COMMENT 'Win probability percentage (0-100)',
	AMOUNT COMMENT 'Expected deal value in transaction currency',
	CURRENCY_ISO_CODE COMMENT 'ISO currency code for the opportunity amount',
	CLOSE_DATE COMMENT 'Expected or actual close date',
	CREATED_DATE COMMENT 'Date when the opportunity was created',
	LAST_MODIFIED_DATE COMMENT 'Timestamp of the last update',
	LAST_ACTIVITY_DATE COMMENT 'Date of the most recent activity on this opportunity',
	IS_CLOSED COMMENT 'Flag indicating if the opportunity is closed (won or lost)',
	IS_WON COMMENT 'Flag indicating if the closed opportunity was won',
	IS_DELETED COMMENT 'Flag indicating if the record is soft-deleted',
	TYPE COMMENT 'Type of opportunity: New Business, Renewal, Upsell, etc.',
	LEAD_SOURCE COMMENT 'Source of the lead: Website, Referral, Event, etc.',
	FORECAST_CATEGORY COMMENT 'Forecast category: Pipeline, Best Case, Commit, Closed',
	FORECAST_CATEGORY_NAME COMMENT 'Display name for the forecast category',
	OWNER_ID COMMENT 'ID of the sales rep who owns this opportunity',
	OWNER_NAME COMMENT 'Name of the opportunity owner',
	CAMPAIGN_ID COMMENT 'Marketing campaign associated with this opportunity',
	PRIMARY_PRODUCT COMMENT 'Primary product or solution being sold',
	COMPETITOR COMMENT 'Main competitor for this deal',
	SAP_SALES_ORDER COMMENT 'SAP Sales Order number (VBELN) if converted',
	SAP_SALES_ORGANIZATION COMMENT 'SAP Sales Organization (VKORG)',
	SAP_DISTRIBUTION_CHANNEL COMMENT 'SAP Distribution Channel (VTWEG)',
	FISCAL_QUARTER COMMENT 'Fiscal quarter for close date (Q1, Q2, Q3, Q4)',
	FISCAL_YEAR COMMENT 'Fiscal year for the close date'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.CRM_OPPORTUNITY_OPPORTUNITY;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.CRM_OPPORTUNITY_SALES_REP(
	REP_ID COMMENT 'Unique identifier for the sales representative',
	FIRST_NAME COMMENT 'First name of the sales representative',
	LAST_NAME COMMENT 'Last name of the sales representative',
	FULL_NAME COMMENT 'Full name of the sales representative',
	EMAIL COMMENT 'Email address of the sales representative',
	TITLE COMMENT 'Job title of the sales representative',
	DEPARTMENT COMMENT 'Department or team the rep belongs to',
	REGION COMMENT 'Sales region or geographic territory',
	TERRITORY COMMENT 'Specific sales territory assigned',
	MANAGER_ID COMMENT 'ID of the sales manager',
	MANAGER_NAME COMMENT 'Name of the sales manager',
	HIRE_DATE COMMENT 'Date when the sales rep was hired',
	IS_ACTIVE COMMENT 'Flag indicating if the rep is currently active',
	QUOTA_AMOUNT COMMENT 'Sales quota or target amount for the rep',
	CREATED_DATE COMMENT 'Date when the rep record was created'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.CRM_OPPORTUNITY_SALES_REP;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.CUSTOMER_CUSTOMER(
	CUSTOMER COMMENT 'SAP Customer number (KUNNR) - primary identifier',
	CUSTOMERNAME COMMENT 'Primary customer name (NAME1)',
	CUSTOMERFULLNAME COMMENT 'Full customer name including all name fields',
	BPCUSTOMERNAME COMMENT 'Business Partner customer name',
	BPCUSTOMERFULLNAME COMMENT 'Full Business Partner customer name',
	CREATEDBYUSER COMMENT 'User ID who created the customer master record',
	CREATIONDATE COMMENT 'Date when the customer master was created',
	ADDRESSID COMMENT 'Address number for the customer',
	CUSTOMERCLASSIFICATION COMMENT 'Customer classification code for grouping',
	VATREGISTRATION COMMENT 'VAT registration number for tax purposes',
	CUSTOMERACCOUNTGROUP COMMENT 'Account group controlling customer master data fields',
	AUTHORIZATIONGROUP COMMENT 'Authorization group for access control',
	DELIVERYISBLOCKED COMMENT 'Flag if delivery is blocked for this customer',
	POSTINGISBLOCKED COMMENT 'Flag if posting is blocked for this customer',
	BILLINGISBLOCKEDFORCUSTOMER COMMENT 'Flag if billing is blocked',
	ORDERISBLOCKEDFORCUSTOMER COMMENT 'Flag if order creation is blocked',
	INTERNATIONALLOCATIONNUMBER1 COMMENT 'International Location Number (ILN/GLN)',
	ISONETIMEACCOUNT COMMENT 'Flag indicating one-time customer account',
	TAXJURISDICTION COMMENT 'Tax jurisdiction code',
	INDUSTRY COMMENT 'Industry sector code',
	COUNTRY COMMENT 'Country code (ISO 2-letter)',
	ORGANIZATIONBPNAME1 COMMENT 'Organization name line 1',
	ORGANIZATIONBPNAME2 COMMENT 'Organization name line 2',
	CITYNAME COMMENT 'City name from customer address',
	POSTALCODE COMMENT 'Postal/ZIP code',
	STREETNAME COMMENT 'Street name and number',
	SORTFIELD COMMENT 'Search term or sort field for customer lookup',
	FAXNUMBER COMMENT 'Fax number',
	REGION COMMENT 'Region or state code',
	TELEPHONENUMBER1 COMMENT 'Primary telephone number',
	TELEPHONENUMBER2 COMMENT 'Secondary telephone number',
	LANGUAGE COMMENT 'Communication language key',
	__OPERATION_TYPE COMMENT 'CDC operation type: INSERT, UPDATE, DELETE',
	__TIMESTAMP COMMENT 'Timestamp of the CDC change event',
	LOAD_TYPE COMMENT 'Data load type: FULL or DELTA',
	RUN_ID COMMENT 'ETL run identifier for tracking data lineage'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.CUSTOMER_CUSTOMER;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.PRODUCT_PRODUCT(
	PRODUCT COMMENT 'SAP Material/Product number (MATNR) - primary identifier',
	PRODUCTEXTERNALID COMMENT 'External product identifier',
	PRODUCTOID COMMENT 'Product Object ID',
	PRODUCTTYPE COMMENT 'Material type (MTART): FERT, HALB, ROH, etc.',
	CREATIONDATE COMMENT 'Date when the product master was created',
	CREATIONTIME COMMENT 'Time when the product master was created',
	CREATIONDATETIME COMMENT 'Full timestamp of product creation',
	CREATEDBYUSER COMMENT 'User ID who created the product master',
	LASTCHANGEDATE COMMENT 'Date of last modification',
	LASTCHANGEDBYUSER COMMENT 'User ID who last modified the record',
	ISMARKEDFORDELETION COMMENT 'Flag if product is marked for deletion',
	CROSSPLANTSTATUS COMMENT 'Cross-plant material status',
	PRODUCTGROUP COMMENT 'Material group (MATKL) for categorization',
	BASEUNIT COMMENT 'Base unit of measure (MEINS)',
	NETWEIGHT COMMENT 'Net weight of the product',
	GROSSWEIGHT COMMENT 'Gross weight including packaging',
	WEIGHTUNIT COMMENT 'Unit of weight measurement',
	DIVISION COMMENT 'Division (SPART) for organizational assignment',
	COUNTRYOFORIGIN COMMENT 'Country of origin for trade compliance',
	PRODUCTHIERARCHY COMMENT 'Product hierarchy for reporting structure',
	__OPERATION_TYPE COMMENT 'CDC operation type: INSERT, UPDATE, DELETE',
	__TIMESTAMP COMMENT 'Timestamp of the CDC change event',
	LOAD_TYPE COMMENT 'Data load type: FULL or DELTA',
	RUN_ID COMMENT 'ETL run identifier for tracking data lineage'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.PRODUCT_PRODUCT;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.PRODUCT_PRODUCTDESCRIPTION(
	PRODUCT COMMENT 'SAP Material/Product number (MATNR)',
	LANGUAGE COMMENT 'Language key (SPRAS) for the description',
	PRODUCTDESCRIPTION COMMENT 'Material description text (MAKTX)',
	LANGUAGEISOCODE COMMENT 'ISO language code (EN, DE, FR, etc.)',
	__OPERATION_TYPE COMMENT 'CDC operation type: INSERT, UPDATE, DELETE',
	__TIMESTAMP COMMENT 'Timestamp of the CDC change event',
	LOAD_TYPE COMMENT 'Data load type: FULL or DELTA',
	RUN_ID COMMENT 'ETL run identifier for tracking data lineage'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.PRODUCT_PRODUCTDESCRIPTION;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.PRODUCT_PRODUCTGROUP(
	PRODUCTGROUP COMMENT 'Material group code (MATKL) - primary identifier',
	AUTHORIZATIONGROUP COMMENT 'Authorization group for access control',
	VALUATIONCLASS COMMENT 'Valuation class for accounting',
	PURCHASINGACKNPROFILE COMMENT 'Purchasing acknowledgment profile',
	__OPERATION_TYPE COMMENT 'CDC operation type: INSERT, UPDATE, DELETE',
	__TIMESTAMP COMMENT 'Timestamp of the CDC change event',
	LOAD_TYPE COMMENT 'Data load type: FULL or DELTA',
	RUN_ID COMMENT 'ETL run identifier for tracking data lineage'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.PRODUCT_PRODUCTGROUP;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.PRODUCT_PRODUCTGROUPTEXT(
	PRODUCTGROUP COMMENT 'Material group code (MATKL)',
	LANGUAGE COMMENT 'Language key (SPRAS) for the text',
	PRODUCTGROUPNAME COMMENT 'Material group name (WGBEZ)',
	PRODUCTGROUPTEXT COMMENT 'Extended material group description',
	__OPERATION_TYPE COMMENT 'CDC operation type: INSERT, UPDATE, DELETE',
	__TIMESTAMP COMMENT 'Timestamp of the CDC change event',
	LOAD_TYPE COMMENT 'Data load type: FULL or DELTA',
	RUN_ID COMMENT 'ETL run identifier for tracking data lineage'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.PRODUCT_PRODUCTGROUPTEXT;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.SALESORDERS_SALESORDER(
	SALESORDER COMMENT 'SAP Sales Order number (VBELN) - primary identifier',
	SALESORDERTYPE COMMENT 'Sales document type (AUART)',
	SALESORDERPROCESSINGTYPE COMMENT 'Processing type for the sales order',
	CREATEDBYUSER COMMENT 'User ID who created the sales order',
	LASTCHANGEDBYUSER COMMENT 'User ID who last modified the order',
	CREATIONDATE COMMENT 'Date when the order was created (ERDAT)',
	CREATIONTIME COMMENT 'Time when the order was created (ERZET)',
	LASTCHANGEDATE COMMENT 'Date of last modification',
	LASTCHANGEDATETIME COMMENT 'Full timestamp of last modification',
	SALESORGANIZATION COMMENT 'Sales organization (VKORG)',
	DISTRIBUTIONCHANNEL COMMENT 'Distribution channel (VTWEG)',
	ORGANIZATIONDIVISION COMMENT 'Division (SPART)',
	SALESGROUP COMMENT 'Sales group',
	SALESOFFICE COMMENT 'Sales office',
	SOLDTOPARTY COMMENT 'Sold-to party customer number (KUNNR)',
	CUSTOMERGROUP COMMENT 'Customer group for pricing/statistics',
	SALESORDERDATE COMMENT 'Sales order date (AUDAT)',
	PURCHASEORDERBYCUSTOMER COMMENT 'Customer purchase order number (BSTNK)',
	CUSTOMERPURCHASEORDERDATE COMMENT 'Date of customer PO',
	TOTALNETAMOUNT COMMENT 'Total net value of the order (NETWR)',
	TRANSACTIONCURRENCY COMMENT 'Order currency (WAERK)',
	PRICINGDATE COMMENT 'Date for price determination',
	INCOTERMSCLASSIFICATION COMMENT 'Incoterms code (FOB, CIF, etc.)',
	INCOTERMSLOCATION1 COMMENT 'Incoterms location 1 (named place)',
	INCOTERMSLOCATION2 COMMENT 'Incoterms location 2 (destination)',
	REQUESTEDDELIVERYDATE COMMENT 'Customer requested delivery date (VDATU)',
	CUSTOMERPAYMENTTERMS COMMENT 'Payment terms key',
	__OPERATION_TYPE COMMENT 'CDC operation type: INSERT, UPDATE, DELETE',
	__TIMESTAMP COMMENT 'Timestamp of the CDC change event',
	LOAD_TYPE COMMENT 'Data load type: FULL or DELTA',
	RUN_ID COMMENT 'ETL run identifier for tracking data lineage'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.SALESORDERS_SALESORDER;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.SALESORDERS_SALESORDERITEM(
	SALESORDER COMMENT 'SAP Sales Order number (VBELN)',
	SALESORDERITEM COMMENT 'Sales order item number (POSNR)',
	SALESORDERITEMUUID COMMENT 'Unique UUID for the sales order item',
	SALESORDERITEMCATEGORY COMMENT 'Item category (PSTYV)',
	SALESORDERITEMTYPE COMMENT 'Item type for processing control',
	ISRETURNSITEM COMMENT 'Flag indicating if this is a returns item',
	CREATEDBYUSER COMMENT 'User ID who created the line item',
	CREATIONDATE COMMENT 'Date when the item was created',
	DIVISION COMMENT 'Division (SPART) at item level',
	MATERIAL COMMENT 'Material number (MATNR)',
	PRODUCT COMMENT 'Product number (same as Material)',
	MATERIALGROUP COMMENT 'Material group (MATKL)',
	PRODUCTGROUP COMMENT 'Product group for categorization',
	PLANT COMMENT 'Delivering plant (WERKS)',
	SALESORDERITEMTEXT COMMENT 'Item description text',
	ORDERQUANTITY COMMENT 'Ordered quantity (KWMENG)',
	ORDERQUANTITYUNIT COMMENT 'Unit of measure for order quantity',
	NETAMOUNT COMMENT 'Net value of the line item (NETWR)',
	TRANSACTIONCURRENCY COMMENT 'Currency for the line item',
	PRICINGDATE COMMENT 'Pricing date for the item',
	NETPRICEAMOUNT COMMENT 'Net price per unit',
	__OPERATION_TYPE COMMENT 'CDC operation type: INSERT, UPDATE, DELETE',
	__TIMESTAMP COMMENT 'Timestamp of the CDC change event',
	LOAD_TYPE COMMENT 'Data load type: FULL or DELTA',
	RUN_ID COMMENT 'ETL run identifier for tracking data lineage'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
    SELECT * FROM SAP_SALES_360.SAP_BDC_L1.SALESORDERS_SALESORDERITEM;
create or replace dynamic table SAP_SALES_360.SALES_360_L2.SALES_FORECAST_VS_ACTUAL(
	FORECAST_ID COMMENT 'Unique identifier for each forecast record (UUID)',
	FISCAL_YEAR COMMENT 'Fiscal year of the forecast/actual period (e.g. 2023, 2024, 2025)',
	FISCAL_MONTH COMMENT 'Fiscal month of the forecast/actual period (1-12)',
	PERIOD_DATE COMMENT 'First day of the month — common date key joining forecast and actual periods',
	SALESORGANIZATION COMMENT 'SAP Sales Organization code linking forecast to actuals',
	SOLDTOPARTY COMMENT 'SAP Customer number (sold-to party) linking forecast to actuals',
	PRODUCTGROUP COMMENT 'SAP Product Group code linking forecast to actuals',
	FORECAST_VERSION COMMENT 'Forecast scenario — PLAN (baseline), REVISED (mid-cycle), or STRETCH (aggressive)',
	FORECAST_AMOUNT COMMENT 'Forecasted revenue amount for the period in transaction currency',
	FORECAST_ORDER_COUNT COMMENT 'Forecasted number of orders for the period',
	ACTUAL_AMOUNT COMMENT 'Actual booked revenue from sales orders for the period (0 if no actuals)',
	ACTUAL_ORDER_COUNT COMMENT 'Actual distinct sales order count for the period (0 if no actuals)',
	VARIANCE_AMOUNT COMMENT 'Actual minus forecast revenue — positive means exceeded forecast',
	ATTAINMENT_PCT COMMENT 'Actual revenue as a percentage of forecast (100 = on target, >100 = exceeded)',
	CURRENCY COMMENT 'ISO currency code for all monetary amounts (default USD)'
) target_lag = '10 minutes' refresh_mode = AUTO initialize = ON_CREATE warehouse = COMPUTE_WH
 as
WITH ACTUALS AS (
    SELECT
        YEAR(so.SALESORDERDATE)                          AS FISCAL_YEAR,
        MONTH(so.SALESORDERDATE)                         AS FISCAL_MONTH,
        DATE_TRUNC('MONTH', so.SALESORDERDATE)           AS PERIOD_DATE,
        so.SALESORGANIZATION,
        so.SOLDTOPARTY,
        COALESCE(NULLIF(si.PRODUCTGROUP,''), 'GENERAL')  AS PRODUCTGROUP,
        SUM(so.TOTALNETAMOUNT)                           AS ACTUAL_AMOUNT,
        COUNT(DISTINCT so.SALESORDER)                    AS ACTUAL_ORDER_COUNT
    FROM SAP_SALES_360.SAP_BDC_L1.SALESORDERS_SALESORDER so
    JOIN SAP_SALES_360.SAP_BDC_L1.SALESORDERS_SALESORDERITEM si
        ON so.SALESORDER = si.SALESORDER
    WHERE so.SALESORDERDATE >= '2023-01-01'
      AND so.SALESORGANIZATION IN ('1710','F1US','AUC1','USC1','DEC1')
      AND so.TOTALNETAMOUNT > 0
    GROUP BY 1,2,3,4,5,6
)
SELECT
    f.FORECAST_ID,
    f.FISCAL_YEAR,
    f.FISCAL_MONTH,
    f.FORECAST_DATE                                       AS PERIOD_DATE,
    f.SALESORGANIZATION,
    f.SOLDTOPARTY,
    f.PRODUCTGROUP,
    f.FORECAST_VERSION,
    f.FORECAST_AMOUNT,
    f.FORECAST_QUANTITY                                    AS FORECAST_ORDER_COUNT,
    COALESCE(a.ACTUAL_AMOUNT, 0)                          AS ACTUAL_AMOUNT,
    COALESCE(a.ACTUAL_ORDER_COUNT, 0)                     AS ACTUAL_ORDER_COUNT,
    COALESCE(a.ACTUAL_AMOUNT, 0) - f.FORECAST_AMOUNT      AS VARIANCE_AMOUNT,
    CASE WHEN f.FORECAST_AMOUNT <> 0
         THEN ROUND((COALESCE(a.ACTUAL_AMOUNT,0) / f.FORECAST_AMOUNT) * 100, 2)
         ELSE NULL
    END                                                   AS ATTAINMENT_PCT,
    f.CURRENCY
FROM SAP_SALES_360.SAP_BDC_L1.SALES_FORECAST f
LEFT JOIN ACTUALS a
    ON  f.FISCAL_YEAR        = a.FISCAL_YEAR
    AND f.FISCAL_MONTH       = a.FISCAL_MONTH
    AND f.SALESORGANIZATION  = a.SALESORGANIZATION
    AND f.SOLDTOPARTY        = a.SOLDTOPARTY
    AND f.PRODUCTGROUP       = a.PRODUCTGROUP;
create or replace TABLE SAP_SALES_360.SALES_360_L2.SALES_REVENUE_FORECAST_METRICS (
	ERROR_METRIC VARCHAR(16777216),
	METRIC_VALUE FLOAT
);
create or replace TABLE SAP_SALES_360.SALES_360_L2.SALES_REVENUE_PREDICTIONS (
	TS TIMESTAMP_NTZ(9),
	FORECAST FLOAT,
	LOWER_BOUND FLOAT,
	UPPER_BOUND FLOAT
);

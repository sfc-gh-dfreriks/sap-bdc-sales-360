-- =====================================================================
-- SAP Sales 360 Native App — SELF-CONTAINED setup script
-- Data is bundled in the package (SHARED_DATA). No consumer references.
-- Powers the SAP_SALES_360_ANALYTICS Cortex Analyst semantic view (the same
-- model behind the account-level SAP_SALES_360_AGENT).
-- =====================================================================

CREATE APPLICATION ROLE IF NOT EXISTS app_public;

CREATE SCHEMA IF NOT EXISTS config;
GRANT USAGE ON SCHEMA config TO APPLICATION ROLE app_public;
CREATE TABLE IF NOT EXISTS config.settings(key STRING, value STRING);

CREATE SCHEMA IF NOT EXISTS app_data;
GRANT USAGE ON SCHEMA app_data TO APPLICATION ROLE app_public;

CREATE OR REPLACE VIEW app_data.CRM_OPPORTUNITY_ACTIVITY AS SELECT * FROM shared_data.CRM_OPPORTUNITY_ACTIVITY;
GRANT SELECT ON VIEW app_data.CRM_OPPORTUNITY_ACTIVITY TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.CRM_OPPORTUNITY_OPPORTUNITY AS SELECT * FROM shared_data.CRM_OPPORTUNITY_OPPORTUNITY;
GRANT SELECT ON VIEW app_data.CRM_OPPORTUNITY_OPPORTUNITY TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.CRM_OPPORTUNITY_SALES_REP AS SELECT * FROM shared_data.CRM_OPPORTUNITY_SALES_REP;
GRANT SELECT ON VIEW app_data.CRM_OPPORTUNITY_SALES_REP TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.CUSTOMER_CUSTOMER AS SELECT * FROM shared_data.CUSTOMER_CUSTOMER;
GRANT SELECT ON VIEW app_data.CUSTOMER_CUSTOMER TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.PRODUCT_PRODUCT AS SELECT * FROM shared_data.PRODUCT_PRODUCT;
GRANT SELECT ON VIEW app_data.PRODUCT_PRODUCT TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.PRODUCT_PRODUCTDESCRIPTION AS SELECT * FROM shared_data.PRODUCT_PRODUCTDESCRIPTION;
GRANT SELECT ON VIEW app_data.PRODUCT_PRODUCTDESCRIPTION TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.PRODUCT_PRODUCTGROUP AS SELECT * FROM shared_data.PRODUCT_PRODUCTGROUP;
GRANT SELECT ON VIEW app_data.PRODUCT_PRODUCTGROUP TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.PRODUCT_PRODUCTGROUPTEXT AS SELECT * FROM shared_data.PRODUCT_PRODUCTGROUPTEXT;
GRANT SELECT ON VIEW app_data.PRODUCT_PRODUCTGROUPTEXT TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.SALESORDERS_SALESORDER AS SELECT * FROM shared_data.SALESORDERS_SALESORDER;
GRANT SELECT ON VIEW app_data.SALESORDERS_SALESORDER TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.SALESORDERS_SALESORDERITEM AS SELECT * FROM shared_data.SALESORDERS_SALESORDERITEM;
GRANT SELECT ON VIEW app_data.SALESORDERS_SALESORDERITEM TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.SALES_FORECAST_VS_ACTUAL AS SELECT * FROM shared_data.SALES_FORECAST_VS_ACTUAL;
GRANT SELECT ON VIEW app_data.SALES_FORECAST_VS_ACTUAL TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.SALES_REVENUE_PREDICTIONS AS SELECT * FROM shared_data.SALES_REVENUE_PREDICTIONS;
GRANT SELECT ON VIEW app_data.SALES_REVENUE_PREDICTIONS TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.SALES_REVENUE_FORECAST_METRICS AS SELECT * FROM shared_data.SALES_REVENUE_FORECAST_METRICS;
GRANT SELECT ON VIEW app_data.SALES_REVENUE_FORECAST_METRICS TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.ATTAINMENT_PREDICTIONS AS SELECT * FROM shared_data.ATTAINMENT_PREDICTIONS;
GRANT SELECT ON VIEW app_data.ATTAINMENT_PREDICTIONS TO APPLICATION ROLE app_public;

-- Semantic view for Cortex Analyst, built over the bundled APP_DATA views.
-- Mirrors SAP_SALES_360.SEMANTIC.SAP_SALES_360_ANALYTICS (SAP_SALES_360_AGENT).
create or replace semantic view app_data.SAP_SALES_360_ANALYTICS
	tables (
		ACTIVITY as APP_DATA.CRM_OPPORTUNITY_ACTIVITY primary key (ACTIVITY_ID),
		CUSTOMER as APP_DATA.CUSTOMER_CUSTOMER primary key (CUSTOMER) with synonyms=('ACCOUNT','BUSINESS_PARTNER','BUYER','CLIENT','CLIENTELE','CONSUMER','CUSTOMER_DATA','CUSTOMER_ENTITY','CUSTOMER_INFO','CUSTOMER_MASTER','CUSTOMER_RECORD','PARTY','PATRON','PURCHASER') comment='The table contains records of customers and their associated business details. Each record represents a single customer and includes identifying information, classification details, account status indicators such as blocking flags for various operations, and tax-related attributes.',
		PRODUCT as APP_DATA.PRODUCT_PRODUCT primary key (PRODUCT) with synonyms=('ARTICLE_DATA','ARTICLE_MASTER','ITEM_DATA','ITEM_MASTER','MATERIAL_DATA','MATERIAL_INFO','MATERIAL_MASTER','MATERIAL_REGISTRY','PRODUCT_CATALOG','PRODUCT_DATA','PRODUCT_INFO','PRODUCT_MASTER','PRODUCT_REGISTRY','PRODUCT_REPOSITORY','SKU_MASTER') comment='The table contains records of products within a sales system. Each record represents a single product and includes identifying information, classification details such as type and hierarchy, physical attributes like weight and dimensions, and administrative metadata tracking creation and modifications.',
		PRODUCT_DESCRIPTION as APP_DATA.PRODUCT_PRODUCTDESCRIPTION primary key (PRODUCT,LANGUAGE) with synonyms=('Article_Description','Item_Description','Item_Text','MAKT','Material_Description','Material_Master_Text','Material_Short_Text','Material_Text','Merchandise_Description','Product_Language_Description','Product_Master_Description','Product_Name','PRODUCT_PRODUCTDESCRIPTION','Product_Text','SKU_Description') comment='The table contains records of product descriptions in multiple languages. Each record represents a product''s descriptive text in a specific language, including language identification and translation details.',
		PRODUCT_GROUP as APP_DATA.PRODUCT_PRODUCTGROUP primary key (PRODUCTGROUP) with synonyms=('Article Group','Item Group','Material Category','Material Group','Merchandise Group','Product Category','Product Classification','Product Material Group','Product Segment','Product Type Group') comment='The table contains records of product groups and their associated configuration settings. Each record includes authorization, valuation, and purchasing acknowledgment profile assignments for organizing and managing products.',
		PRODUCT_GROUP_TEXT as APP_DATA.PRODUCT_PRODUCTGROUPTEXT primary key (PRODUCTGROUP,LANGUAGE) with synonyms=('ArticleGroupText','ItemGroupText','Material_Group_Text','MaterialCategoryText','MaterialClassText','MaterialGroupDescription','MaterialGroupMaster','MaterialGroupText','MATKL_Text','Product_Group_Text','PRODUCT_PRODUCTGROUPTEXT','ProductCategoryText','ProductClassText','ProductGroupDescription','ProductGroupMaster','ProductGroupText') comment='The table contains records of product group descriptions and names in multiple languages. Each record represents a product group''s textual information for a specific language, including both the name and descriptive text.',
		SALES_ORDER as APP_DATA.SALESORDERS_SALESORDER primary key (SALESORDER) with synonyms=('Customer Orders','Order Entry','Order Header','Order Management','Sales Document','Sales Order Header','Sales Orders','Sales Transaction','SO Header') comment='The table contains records of sales orders. Each record represents a single sales order and includes details about the order type, processing status, organizational structure, customer information, and financial amounts.',
		SALES_ORDER_ITEM as APP_DATA.SALESORDERS_SALESORDERITEM primary key (SALESORDER,SALESORDERITEM) with synonyms=('ItemDetails','LineItems','OrderDetails','OrderDocumentItems','OrderItems','OrderLineItems','OrderLines','OrderPositions','SalesDocumentItems','SalesItems','SalesLineItems','SalesOrderDetails','SalesOrderLineItems','SalesOrderLines','SalesOrderPositions') comment='The table contains records of individual line items within sales orders. Each record represents a single item on a sales order and includes details about the product or material, quantities and units, pricing and currency information, organizational attributes, and item classification.',
		SALES_REP as APP_DATA.CRM_OPPORTUNITY_SALES_REP primary key (REP_ID) with synonyms=('account_executive','account_rep','business_development_rep','field_sales_rep','inside_sales_rep','outside_sales_rep','quota_carrier','revenue_representative','sales_agent','sales_associate','sales_consultant','sales_employee','sales_force_member','sales_person','sales_professional','sales_rep','sales_representative','sales_staff','sales_team_member','territory_rep') comment='The table contains records of sales representatives who manage opportunities. Each record includes personal and contact information, organizational hierarchy details, geographic assignment, employment status, and quota information.',
		SFDC_OPPORTUNITY as APP_DATA.CRM_OPPORTUNITY_OPPORTUNITY primary key (ID) with synonyms=('business_opportunity','crm_opportunity','deal','deal_record','opportunity','opportunity_record','potential_sale','prospect_deal','sales_chance','sales_deal','sales_opportunity','sales_pipeline','sales_prospect') comment='The table contains records of sales opportunities tracked in a customer relationship management system. Each record represents a potential deal and includes details about the associated account, deal characteristics, financial value, and progression through sales stages. Records also capture timing information, outcome status, and forecasting classifications.',
		FORECAST_VS_ACTUAL as APP_DATA.SALES_FORECAST_VS_ACTUAL primary key (FORECAST_ID) with synonyms=('actual_vs_forecast','budget_vs_actual','forecast','forecast_actuals','forecast_comparison','forecast_variance','plan_vs_actual','sales_forecast','sales_plan','target_vs_actual') comment='The table joins monthly sales forecasts with actual booked revenue from sales orders. Each record represents one forecast version (PLAN, REVISED, or STRETCH) for a specific month, sales org, customer, and product group, alongside the matched actual revenue and order counts. Key calculated fields include variance (actual minus forecast) and attainment percentage.'
	)
	relationships (
		ACTIVITY_TO_OPPORTUNITY as ACTIVITY(OPPORTUNITY_ID) references SFDC_OPPORTUNITY(ID),
		PRODUCT_TO_GROUP as PRODUCT(PRODUCTGROUP) references PRODUCT_GROUP(PRODUCTGROUP),
		DESCRIPTION_TO_PRODUCT as PRODUCT_DESCRIPTION(PRODUCT) references PRODUCT(PRODUCT),
		GROUP_TEXT_TO_GROUP as PRODUCT_GROUP_TEXT(PRODUCTGROUP) references PRODUCT_GROUP(PRODUCTGROUP),
		ORDER_TO_CUSTOMER as SALES_ORDER(SOLDTOPARTY) references CUSTOMER(CUSTOMER),
		ITEM_TO_PRODUCT as SALES_ORDER_ITEM(MATERIAL) references PRODUCT(PRODUCT),
		ITEM_TO_ORDER as SALES_ORDER_ITEM(SALESORDER) references SALES_ORDER(SALESORDER),
		OPPORTUNITY_TO_SAP_CUSTOMER as SFDC_OPPORTUNITY(SAP_CUSTOMER_KEY) references CUSTOMER(CUSTOMER),
		OPPORTUNITY_TO_REP as SFDC_OPPORTUNITY(OWNER_ID) references SALES_REP(REP_ID),
		FORECAST_TO_CUSTOMER as FORECAST_VS_ACTUAL(SOLDTOPARTY) references CUSTOMER(CUSTOMER),
		FORECAST_TO_PRODUCT_GROUP as FORECAST_VS_ACTUAL(PRODUCTGROUP) references PRODUCT_GROUP(PRODUCTGROUP)
	)
	facts (
		ACTIVITY.ACTIVITY_DURATION as DURATION_MINUTES with synonyms=('duration','minutes'),
		PRODUCT.NET_WEIGHT as NETWEIGHT,
		SALES_ORDER.ORDER_NET_VALUE as TOTALNETAMOUNT with synonyms=('NETWR','order total'),
		SALES_ORDER_ITEM.LINE_NET_AMOUNT as NETAMOUNT with synonyms=('line total','NETWR'),
		SALES_ORDER_ITEM.ORDER_QUANTITY as ORDERQUANTITY with synonyms=('KWMENG','quantity'),
		SALES_REP.QUOTA_AMOUNT as QUOTA_AMOUNT with synonyms=('quota','target'),
		SFDC_OPPORTUNITY.OPPORTUNITY_AMOUNT as AMOUNT with synonyms=('amount','deal size','value'),
		SFDC_OPPORTUNITY.WIN_PROBABILITY as PROBABILITY with synonyms=('probability'),
		FORECAST_VS_ACTUAL.FORECAST_AMOUNT as FORECAST_AMOUNT with synonyms=('forecast revenue','planned amount','target amount'),
		FORECAST_VS_ACTUAL.FORECAST_ORDER_COUNT as FORECAST_ORDER_COUNT with synonyms=('forecast orders','planned orders'),
		FORECAST_VS_ACTUAL.ACTUAL_AMOUNT as ACTUAL_AMOUNT with synonyms=('actual revenue','booked amount','realized amount'),
		FORECAST_VS_ACTUAL.ACTUAL_ORDER_COUNT as ACTUAL_ORDER_COUNT with synonyms=('actual orders','realized orders'),
		FORECAST_VS_ACTUAL.VARIANCE_AMOUNT as VARIANCE_AMOUNT with synonyms=('forecast gap','forecast miss','variance'),
		FORECAST_VS_ACTUAL.ATTAINMENT_PCT as ATTAINMENT_PCT with synonyms=('achievement','attainment','percent to plan','quota attainment')
	)
	dimensions (
		ACTIVITY.ACTIVITY_DATE as ACTIVITY_DATE with synonyms=('date'),
		ACTIVITY.ACTIVITY_ID as ACTIVITY_ID,
		ACTIVITY.ACTIVITY_OUTCOME as OUTCOME with synonyms=('outcome','result'),
		ACTIVITY.ACTIVITY_OWNER as OWNER_NAME with synonyms=('rep'),
		ACTIVITY.ACTIVITY_PRIORITY as PRIORITY,
		ACTIVITY.ACTIVITY_STATUS as STATUS with synonyms=('status'),
		ACTIVITY.ACTIVITY_SUBJECT as SUBJECT with synonyms=('subject'),
		ACTIVITY.ACTIVITY_TYPE as ACTIVITY_TYPE with synonyms=('engagement type','type'),
		ACTIVITY.CALL_DISPOSITION as CALL_DISPOSITION,
		ACTIVITY.CONTACT_NAME as CONTACT_NAME with synonyms=('contact'),
		ACTIVITY.CONTACT_TITLE as CONTACT_TITLE,
		ACTIVITY.MEETING_TYPE as MEETING_TYPE,
		ACTIVITY.OPPORTUNITY_ID as OPPORTUNITY_ID,
		CUSTOMER.CITY as CITYNAME,
		CUSTOMER.COUNTRY as COUNTRY,
		CUSTOMER.CUSTOMER as CUSTOMER with synonyms=('account','customer id','customer number','KUNNR'),
		CUSTOMER.CUSTOMER_NAME as CUSTOMERNAME with synonyms=('account name','company name'),
		CUSTOMER.REGION as REGION,
		PRODUCT.BASE_UNIT as BASEUNIT with synonyms=('UOM'),
		PRODUCT.PRODUCT as PRODUCT with synonyms=('material number','MATNR','product id','SKU'),
		PRODUCT.PRODUCT_TYPE as PRODUCTTYPE with synonyms=('material type','MTART'),
		PRODUCT.PRODUCTGROUP as PRODUCTGROUP with synonyms=('material group','MATKL','product group'),
		PRODUCT_DESCRIPTION.DESCRIPTION as PRODUCTDESCRIPTION with synonyms=('MAKTX','material description','product name'),
		PRODUCT_DESCRIPTION.LANGUAGE as LANGUAGE with synonyms=('language key','SPRAS'),
		PRODUCT_DESCRIPTION.LANGUAGE_ISO as LANGUAGEISOCODE with synonyms=('language code'),
		PRODUCT_DESCRIPTION.PRODUCT as PRODUCT,
		PRODUCT_GROUP.AUTHORIZATION_GROUP as AUTHORIZATIONGROUP,
		PRODUCT_GROUP.PRODUCTGROUP as PRODUCTGROUP with synonyms=('material group','MATKL','product group id'),
		PRODUCT_GROUP.VALUATION_CLASS as VALUATIONCLASS,
		PRODUCT_GROUP_TEXT.LANGUAGE as LANGUAGE with synonyms=('SPRAS'),
		PRODUCT_GROUP_TEXT.PRODUCT_GROUP_DESCRIPTION as PRODUCTGROUPTEXT with synonyms=('group description'),
		PRODUCT_GROUP_TEXT.PRODUCT_GROUP_NAME as PRODUCTGROUPNAME with synonyms=('category name','group name','WGBEZ'),
		PRODUCT_GROUP_TEXT.PRODUCTGROUP as PRODUCTGROUP,
		SALES_ORDER.CURRENCY as TRANSACTIONCURRENCY,
		SALES_ORDER.DISTRIBUTION_CHANNEL as DISTRIBUTIONCHANNEL with synonyms=('channel','VTWEG'),
		SALES_ORDER.ORDER_DATE as CREATIONDATE with synonyms=('sales order date'),
		SALES_ORDER.SALES_ORDER_TYPE as SALESORDERTYPE with synonyms=('AUART','order type'),
		SALES_ORDER.SALES_ORGANIZATION as SALESORGANIZATION with synonyms=('sales org','VKORG'),
		SALES_ORDER.SALESORDER as SALESORDER with synonyms=('order number','sales order number','SO number','VBELN'),
		SALES_ORDER.SOLDTOPARTY as SOLDTOPARTY with synonyms=('customer ID','sold to party'),
		SALES_ORDER_ITEM.MATERIAL as MATERIAL with synonyms=('MATNR','product'),
		SALES_ORDER_ITEM.PLANT as PLANT with synonyms=('warehouse','WERKS'),
		SALES_ORDER_ITEM.SALESORDER as SALESORDER,
		SALES_ORDER_ITEM.SALESORDERITEM as SALESORDERITEM with synonyms=('item number','line item','POSNR'),
		SALES_REP.HIRE_DATE as HIRE_DATE,
		SALES_REP.MANAGER_NAME as MANAGER_NAME with synonyms=('manager'),
		SALES_REP.REP_DEPARTMENT as DEPARTMENT,
		SALES_REP.REP_EMAIL as EMAIL,
		SALES_REP.REP_ID as REP_ID with synonyms=('owner id','sales rep id'),
		SALES_REP.REP_NAME as FULL_NAME with synonyms=('rep','sales rep name','salesperson'),
		SALES_REP.REP_TITLE as TITLE with synonyms=('job title','role'),
		SALES_REP.SALES_REGION as REGION with synonyms=('geo','region'),
		SALES_REP.TERRITORY as TERRITORY,
		SFDC_OPPORTUNITY.CLOSE_DATE as CLOSE_DATE with synonyms=('expected close'),
		SFDC_OPPORTUNITY.COMPETITOR as COMPETITOR,
		SFDC_OPPORTUNITY.CREATED_DATE as CREATED_DATE,
		SFDC_OPPORTUNITY.CURRENCY_CODE as CURRENCY_ISO_CODE,
		SFDC_OPPORTUNITY.FISCAL_QUARTER as FISCAL_QUARTER with synonyms=('FQ','quarter'),
		SFDC_OPPORTUNITY.FISCAL_YEAR as FISCAL_YEAR with synonyms=('FY','year'),
		SFDC_OPPORTUNITY.FORECAST_CATEGORY as FORECAST_CATEGORY with synonyms=('commit','forecast'),
		SFDC_OPPORTUNITY.ID as ID with synonyms=('deal id','opp id','opportunity id'),
		SFDC_OPPORTUNITY.IS_CLOSED as IS_CLOSED,
		SFDC_OPPORTUNITY.IS_WON as IS_WON with synonyms=('closed won','won'),
		SFDC_OPPORTUNITY.LEAD_SOURCE as LEAD_SOURCE with synonyms=('source'),
		SFDC_OPPORTUNITY.OPPORTUNITY_NAME as NAME with synonyms=('deal name','opp name'),
		SFDC_OPPORTUNITY.OPPORTUNITY_TYPE as TYPE with synonyms=('deal type'),
		SFDC_OPPORTUNITY.OWNER_ID as OWNER_ID,
		SFDC_OPPORTUNITY.OWNER_NAME as OWNER_NAME with synonyms=('rep name','sales rep'),
		SFDC_OPPORTUNITY.SAP_CUSTOMER_KEY as SAP_CUSTOMER_KEY with synonyms=('customer id','KUNNR'),
		SFDC_OPPORTUNITY.STAGE_NAME as STAGE_NAME with synonyms=('pipeline stage','sales stage','stage'),
		FORECAST_VS_ACTUAL.FORECAST_ID as FORECAST_ID,
		FORECAST_VS_ACTUAL.FISCAL_YEAR as FISCAL_YEAR with synonyms=('forecast year','plan year'),
		FORECAST_VS_ACTUAL.FISCAL_MONTH as FISCAL_MONTH with synonyms=('forecast month','plan month'),
		FORECAST_VS_ACTUAL.PERIOD_DATE as PERIOD_DATE with synonyms=('forecast date','forecast period','plan date'),
		FORECAST_VS_ACTUAL.SALESORGANIZATION as SALESORGANIZATION with synonyms=('forecast org','forecast sales organization'),
		FORECAST_VS_ACTUAL.SOLDTOPARTY as SOLDTOPARTY with synonyms=('forecast customer','forecast sold-to'),
		FORECAST_VS_ACTUAL.PRODUCTGROUP as PRODUCTGROUP with synonyms=('forecast category','forecast product category'),
		FORECAST_VS_ACTUAL.FORECAST_VERSION as FORECAST_VERSION with synonyms=('budget version','plan version','scenario'),
		FORECAST_VS_ACTUAL.CURRENCY as CURRENCY
	)
	metrics (
		ACTIVITY.ACTIVITY_COUNT as COUNT(DISTINCT ACTIVITY_ID) with synonyms=('number of activities'),
		ACTIVITY.AVG_ACTIVITY_DURATION as AVG(DURATION_MINUTES),
		ACTIVITY.CALL_COUNT as SUM(CASE WHEN ACTIVITY_TYPE = 'Call' THEN 1 ELSE 0 END),
		ACTIVITY.EMAIL_COUNT as SUM(CASE WHEN ACTIVITY_TYPE = 'Email' THEN 1 ELSE 0 END),
		ACTIVITY.MEETING_COUNT as SUM(CASE WHEN ACTIVITY_TYPE = 'Meeting' THEN 1 ELSE 0 END),
		ACTIVITY.TOTAL_ACTIVITY_MINUTES as SUM(DURATION_MINUTES) with synonyms=('total time'),
		CUSTOMER.CUSTOMER_COUNT as COUNT(DISTINCT CUSTOMER),
		PRODUCT.PRODUCT_COUNT as COUNT(DISTINCT PRODUCT),
		PRODUCT_DESCRIPTION.DESCRIPTION_COUNT as COUNT(*),
		PRODUCT_GROUP.PRODUCT_GROUP_COUNT as COUNT(DISTINCT PRODUCTGROUP),
		PRODUCT_GROUP_TEXT.GROUP_TEXT_COUNT as COUNT(*),
		SALES_ORDER.SAP_ORDER_COUNT as COUNT(DISTINCT SALESORDER),
		SALES_ORDER.SAP_REVENUE as SUM(TOTALNETAMOUNT) with synonyms=('booked revenue','total sales'),
		SALES_ORDER_ITEM.TOTAL_QUANTITY_SOLD as SUM(ORDERQUANTITY),
		SALES_REP.REP_COUNT as COUNT(DISTINCT REP_ID) with synonyms=('headcount','number of reps'),
		SALES_REP.TOTAL_QUOTA as SUM(QUOTA_AMOUNT),
		SFDC_OPPORTUNITY.AVG_DEAL_SIZE as AVG(AMOUNT) with synonyms=('average deal'),
		SFDC_OPPORTUNITY.CLOSED_WON_VALUE as SUM(CASE WHEN IS_WON THEN AMOUNT ELSE 0 END) with synonyms=('bookings','won revenue'),
		SFDC_OPPORTUNITY.OPPORTUNITY_COUNT as COUNT(DISTINCT ID) with synonyms=('deal count','number of opportunities'),
		SFDC_OPPORTUNITY.TOTAL_PIPELINE as SUM(AMOUNT) with synonyms=('pipeline value'),
		SFDC_OPPORTUNITY.WEIGHTED_PIPELINE as SUM(AMOUNT * PROBABILITY / 100) with synonyms=('weighted forecast'),
		SFDC_OPPORTUNITY.WIN_RATE as AVG(CASE WHEN IS_CLOSED THEN CASE WHEN IS_WON THEN 100.0 ELSE 0.0 END END) with synonyms=('close rate'),
		FORECAST_VS_ACTUAL.TOTAL_FORECAST_AMOUNT as SUM(FORECAST_AMOUNT) with synonyms=('total forecast','total plan'),
		FORECAST_VS_ACTUAL.TOTAL_ACTUAL_AMOUNT as SUM(ACTUAL_AMOUNT) with synonyms=('total actual revenue','total actuals'),
		FORECAST_VS_ACTUAL.TOTAL_VARIANCE as SUM(VARIANCE_AMOUNT) with synonyms=('net variance','total gap'),
		FORECAST_VS_ACTUAL.AVG_ATTAINMENT as AVG(ATTAINMENT_PCT) with synonyms=('average attainment','mean attainment'),
		FORECAST_VS_ACTUAL.FORECAST_RECORD_COUNT as COUNT(DISTINCT FORECAST_ID) with synonyms=('forecast count','number of forecasts'),
		FORECAST_VS_ACTUAL.TOTAL_FORECAST_ORDERS as SUM(FORECAST_ORDER_COUNT) with synonyms=('planned order total'),
		FORECAST_VS_ACTUAL.TOTAL_ACTUAL_ORDERS as SUM(ACTUAL_ORDER_COUNT) with synonyms=('actual order total'),
		FORECAST_VS_ACTUAL.ABOVE_PLAN_COUNT as SUM(CASE WHEN ATTAINMENT_PCT >= 100 THEN 1 ELSE 0 END) with synonyms=('exceeded forecast count','on target count')
	)
	comment='SAP BDC Sales 360 Analytics Dynamic Tables with CRM Integration'
	with extension (CA='{"tables":[{"name":"ACTIVITY","dimensions":[{"name":"ACTIVITY_DATE"},{"name":"ACTIVITY_ID"},{"name":"ACTIVITY_OUTCOME"},{"name":"ACTIVITY_OWNER"},{"name":"ACTIVITY_PRIORITY"},{"name":"ACTIVITY_STATUS"},{"name":"ACTIVITY_SUBJECT"},{"name":"ACTIVITY_TYPE"},{"name":"CALL_DISPOSITION"},{"name":"CONTACT_NAME"},{"name":"CONTACT_TITLE"},{"name":"MEETING_TYPE"},{"name":"OPPORTUNITY_ID"}],"facts":[{"name":"ACTIVITY_DURATION"}],"metrics":[{"name":"ACTIVITY_COUNT"},{"name":"AVG_ACTIVITY_DURATION"},{"name":"CALL_COUNT"},{"name":"EMAIL_COUNT"},{"name":"MEETING_COUNT"},{"name":"TOTAL_ACTIVITY_MINUTES"}]},{"name":"CUSTOMER","dimensions":[{"name":"CITY"},{"name":"COUNTRY"},{"name":"CUSTOMER"},{"name":"CUSTOMER_NAME"},{"name":"REGION"}],"metrics":[{"name":"CUSTOMER_COUNT"}]},{"name":"PRODUCT","dimensions":[{"name":"BASE_UNIT"},{"name":"PRODUCT"},{"name":"PRODUCT_TYPE"},{"name":"PRODUCTGROUP"}],"facts":[{"name":"NET_WEIGHT"}],"metrics":[{"name":"PRODUCT_COUNT"}]},{"name":"PRODUCT_DESCRIPTION","dimensions":[{"name":"DESCRIPTION"},{"name":"LANGUAGE"},{"name":"LANGUAGE_ISO"},{"name":"PRODUCT"}],"metrics":[{"name":"DESCRIPTION_COUNT"}]},{"name":"PRODUCT_GROUP","dimensions":[{"name":"AUTHORIZATION_GROUP"},{"name":"PRODUCTGROUP"},{"name":"VALUATION_CLASS"}],"metrics":[{"name":"PRODUCT_GROUP_COUNT"}]},{"name":"PRODUCT_GROUP_TEXT","dimensions":[{"name":"LANGUAGE"},{"name":"PRODUCT_GROUP_DESCRIPTION"},{"name":"PRODUCT_GROUP_NAME"},{"name":"PRODUCTGROUP"}],"metrics":[{"name":"GROUP_TEXT_COUNT"}]},{"name":"SALES_ORDER","dimensions":[{"name":"CURRENCY"},{"name":"DISTRIBUTION_CHANNEL"},{"name":"ORDER_DATE"},{"name":"SALES_ORDER_TYPE"},{"name":"SALES_ORGANIZATION"},{"name":"SALESORDER"},{"name":"SOLDTOPARTY"}],"facts":[{"name":"ORDER_NET_VALUE"}],"metrics":[{"name":"SAP_ORDER_COUNT"},{"name":"SAP_REVENUE"}]},{"name":"SALES_ORDER_ITEM","dimensions":[{"name":"MATERIAL"},{"name":"PLANT"},{"name":"SALESORDER"},{"name":"SALESORDERITEM"}],"facts":[{"name":"LINE_NET_AMOUNT"},{"name":"ORDER_QUANTITY"}],"metrics":[{"name":"TOTAL_QUANTITY_SOLD"}]},{"name":"SALES_REP","dimensions":[{"name":"HIRE_DATE"},{"name":"MANAGER_NAME"},{"name":"REP_DEPARTMENT"},{"name":"REP_EMAIL"},{"name":"REP_ID"},{"name":"REP_NAME"},{"name":"REP_TITLE"},{"name":"SALES_REGION"},{"name":"TERRITORY"}],"facts":[{"name":"QUOTA_AMOUNT"}],"metrics":[{"name":"REP_COUNT"},{"name":"TOTAL_QUOTA"}]},{"name":"SFDC_OPPORTUNITY","dimensions":[{"name":"CLOSE_DATE"},{"name":"COMPETITOR"},{"name":"CREATED_DATE"},{"name":"CURRENCY_CODE"},{"name":"FISCAL_QUARTER"},{"name":"FISCAL_YEAR"},{"name":"FORECAST_CATEGORY"},{"name":"ID"},{"name":"IS_CLOSED"},{"name":"IS_WON"},{"name":"LEAD_SOURCE"},{"name":"OPPORTUNITY_NAME"},{"name":"OPPORTUNITY_TYPE"},{"name":"OWNER_ID"},{"name":"OWNER_NAME"},{"name":"SAP_CUSTOMER_KEY"},{"name":"STAGE_NAME"}],"facts":[{"name":"OPPORTUNITY_AMOUNT"},{"name":"WIN_PROBABILITY"}],"metrics":[{"name":"AVG_DEAL_SIZE"},{"name":"CLOSED_WON_VALUE"},{"name":"OPPORTUNITY_COUNT"},{"name":"TOTAL_PIPELINE"},{"name":"WEIGHTED_PIPELINE"},{"name":"WIN_RATE"}]},{"name":"FORECAST_VS_ACTUAL","dimensions":[{"name":"FORECAST_ID"},{"name":"FISCAL_YEAR"},{"name":"FISCAL_MONTH"},{"name":"PERIOD_DATE"},{"name":"SALESORGANIZATION"},{"name":"SOLDTOPARTY"},{"name":"PRODUCTGROUP"},{"name":"FORECAST_VERSION"},{"name":"CURRENCY"}],"facts":[{"name":"FORECAST_AMOUNT"},{"name":"FORECAST_ORDER_COUNT"},{"name":"ACTUAL_AMOUNT"},{"name":"ACTUAL_ORDER_COUNT"},{"name":"VARIANCE_AMOUNT"},{"name":"ATTAINMENT_PCT"}],"metrics":[{"name":"TOTAL_FORECAST_AMOUNT"},{"name":"TOTAL_ACTUAL_AMOUNT"},{"name":"TOTAL_VARIANCE"},{"name":"AVG_ATTAINMENT"},{"name":"FORECAST_RECORD_COUNT"},{"name":"TOTAL_FORECAST_ORDERS"},{"name":"TOTAL_ACTUAL_ORDERS"},{"name":"ABOVE_PLAN_COUNT"}]}],"relationships":[{"name":"ACTIVITY_TO_OPPORTUNITY"},{"name":"PRODUCT_TO_GROUP"},{"name":"DESCRIPTION_TO_PRODUCT"},{"name":"GROUP_TEXT_TO_GROUP"},{"name":"ORDER_TO_CUSTOMER"},{"name":"ITEM_TO_ORDER"},{"name":"ITEM_TO_PRODUCT"},{"name":"OPPORTUNITY_TO_REP"},{"name":"OPPORTUNITY_TO_SAP_CUSTOMER"},{"name":"FORECAST_TO_CUSTOMER"},{"name":"FORECAST_TO_PRODUCT_GROUP"}]}');
GRANT SELECT ON SEMANTIC VIEW app_data.SAP_SALES_360_ANALYTICS TO APPLICATION ROLE app_public;

DELETE FROM config.settings WHERE key = 'semantic_view';
INSERT INTO config.settings(key, value)
  SELECT 'semantic_view', CURRENT_DATABASE() || '.APP_DATA.SAP_SALES_360_ANALYTICS';

CREATE SCHEMA IF NOT EXISTS services;
GRANT USAGE ON SCHEMA services TO APPLICATION ROLE app_public;

CREATE OR ALTER VERSIONED SCHEMA core;
GRANT USAGE ON SCHEMA core TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.version_init()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$
DECLARE
  pool_name VARCHAR;
  wh_name VARCHAR;
  svc_count INTEGER;
BEGIN
  pool_name := (SELECT CURRENT_DATABASE()) || '_POOL';
  wh_name   := (SELECT CURRENT_DATABASE()) || '_WH';
  CREATE COMPUTE POOL IF NOT EXISTS IDENTIFIER(:pool_name)
    MIN_NODES = 1 MAX_NODES = 1 INSTANCE_FAMILY = CPU_X64_S
    AUTO_RESUME = TRUE AUTO_SUSPEND_SECS = 300;
  CREATE WAREHOUSE IF NOT EXISTS IDENTIFIER(:wh_name)
    WAREHOUSE_SIZE = 'SMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE;
  SHOW SERVICES LIKE 'SALES_360_SERVICE' IN SCHEMA services;
  svc_count := (SELECT COUNT(*) FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())));
  IF (:svc_count = 0) THEN
    CREATE SERVICE services.sales_360_service
      IN COMPUTE POOL IDENTIFIER(:pool_name)
      FROM SPECIFICATION_FILE = '/service_spec.yml'
      MIN_INSTANCES = 1 MAX_INSTANCES = 1;
    GRANT USAGE ON SERVICE services.sales_360_service TO APPLICATION ROLE app_public;
    GRANT SERVICE ROLE services.sales_360_service!sales_360_role TO APPLICATION ROLE app_public;
  ELSE
    ALTER SERVICE services.sales_360_service FROM SPECIFICATION_FILE = '/service_spec.yml';
    CALL SYSTEM$WAIT_FOR_SERVICES(600, 'services.sales_360_service');
  END IF;
  RETURN 'version_init ok';
END;
$$;
GRANT USAGE ON PROCEDURE core.version_init() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.suspend_service()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ BEGIN ALTER SERVICE services.sales_360_service SUSPEND; RETURN 'Service suspended'; END; $$;
GRANT USAGE ON PROCEDURE core.suspend_service() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.resume_service()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ BEGIN ALTER SERVICE services.sales_360_service RESUME; RETURN 'Service resumed'; END; $$;
GRANT USAGE ON PROCEDURE core.resume_service() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.get_service_status()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE status VARCHAR;
BEGIN CALL SYSTEM$GET_SERVICE_STATUS('services.sales_360_service') INTO :status; RETURN :status; END; $$;
GRANT USAGE ON PROCEDURE core.get_service_status() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.get_service_logs(instance_id STRING, container_name STRING)
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE logs VARCHAR;
BEGIN CALL SYSTEM$GET_SERVICE_LOGS('services.sales_360_service', :instance_id, :container_name, 200) INTO :logs; RETURN :logs; END; $$;
GRANT USAGE ON PROCEDURE core.get_service_logs(STRING, STRING) TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.app_url()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE url VARCHAR;
BEGIN
  SHOW ENDPOINTS IN SERVICE services.sales_360_service;
  SELECT "ingress_url" INTO :url FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())) WHERE "name" = 'sales360';
  RETURN :url;
END; $$;
GRANT USAGE ON PROCEDURE core.app_url() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.selftest()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE so INTEGER; cust INTEGER;
BEGIN
  SELECT COUNT(*) INTO :so FROM app_data.SALESORDERS_SALESORDER;
  SELECT COUNT(*) INTO :cust FROM app_data.CUSTOMER_CUSTOMER;
  RETURN 'bundled data OK — SALESORDERS_SALESORDER=' || :so || ' rows, CUSTOMER_CUSTOMER=' || :cust || ' rows';
END; $$;
GRANT USAGE ON PROCEDURE core.selftest() TO APPLICATION ROLE app_public;

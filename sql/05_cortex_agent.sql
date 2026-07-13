-- =====================================================================
-- Cortex Agent — SAP_SALES_360_AGENT
-- Account-level agent for Snowflake Intelligence over SAP_SALES_360_ANALYTICS.
-- Prereqs: 04_semantic_view.sql + SNOWFLAKE.CORTEX_USER on the executing role.
-- =====================================================================

CREATE OR REPLACE AGENT SAP_SALES_360.SEMANTIC.SAP_SALES_360_AGENT
WITH PROFILE='{"display_name":"SAP Sales 360 Agent","color":"blue"}'
COMMENT='Sales Analytics Agent for SAP Sales 360 Dynamic Tables'
FROM SPECIFICATION $$
{
  "models": {
    "orchestration": "auto"
  },
  "instructions": {
    "response": "Respond in a clear, professional manner. Present numerical data with appropriate formatting. When showing trends, highlight key insights and summarize findings.",
    "orchestration": "You are a Sales Analytics Assistant for SAP data from the Sales 360 Dynamic Tables layer. Help users analyze sales performance across SAP S/4HANA Sales Orders, Customer Master Data, Product Master Data, and Salesforce CRM Opportunities. Available metrics include total revenue, order counts, product sales, customer analysis, opportunity pipeline, win rates, and sales rep performance."
  },
  "tools": [
    {
      "tool_spec": {
        "type": "cortex_analyst_text_to_sql",
        "name": "query_sap_sales_360",
        "description": "Query SAP Sales 360 Analytics combining sales orders, customers, products, opportunities, activities, and sales representatives from dynamic tables. Use this to analyze revenue, orders, customer segments, product performance, CRM pipeline, and sales activities."
      }
    }
  ],
  "tool_resources": {
    "query_sap_sales_360": {
      "semantic_view": "SAP_SALES_360.SEMANTIC.SAP_SALES_360_ANALYTICS",
      "execution_environment": {
        "type": "warehouse",
        "warehouse": "COMPUTE_WH",
        "query_timeout": 299
      }
    }
  }
}
$$;

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class POSSuggestionItem(BaseModel):
    item_id: str
    item_name: str
    sale_price: float = 0.0
    unit: str = "PCS"
    score: float = Field(..., description="Relevance / affinity score between 0 and 1")
    reason: str = Field(..., description="Recommendation explanation e.g. 'Frequently bought with X' or 'Top repeat purchase'")
    category: Optional[str] = "General"
    barcode: Optional[str] = None


class POSSuggestionsResponse(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    cart_items_count: int = 0
    suggestions: List[POSSuggestionItem] = []


class RestockSuggestionItem(BaseModel):
    item_id: str
    item_name: str
    category: Optional[str] = "General"
    current_stock: float = 0.0
    avg_daily_sales: float = 0.0
    days_left: float = 999.0
    reorder_point: float = 0.0
    suggested_quantity: float = 0.0
    urgency: str = Field(..., description="CRITICAL, WARNING, or HEALTHY")
    estimated_cost: float = 0.0
    godown_id: Optional[str] = None
    godown_name: Optional[str] = None


class RestockSuggestionsResponse(BaseModel):
    total_items_analyzed: int
    critical_count: int
    warning_count: int
    healthy_count: int
    estimated_total_reorder_cost: float
    suggestions: List[RestockSuggestionItem] = []


class AssociationRuleItem(BaseModel):
    antecedent_id: str
    antecedent_name: str
    consequent_id: str
    consequent_name: str
    support: float
    confidence: float
    lift: float
    co_count: Optional[int] = 0


class AssociationRulesResponse(BaseModel):
    total_rules: int
    rules: List[AssociationRuleItem] = []


class NLQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500, description="Natural language prompt / question in English or Hinglish")
    context_filter: Optional[str] = None


class NLQueryResponse(BaseModel):
    query: str
    answer: str
    intent: str
    data_summary: Optional[Dict[str, Any]] = None
    suggested_actions: List[str] = []
    confidence: float = 0.95


class AIBatchRunResponse(BaseModel):
    success: bool
    rules_generated: int
    restock_forecasts_computed: int
    duration_seconds: float
    message: str

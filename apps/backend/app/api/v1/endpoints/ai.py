from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user, require_module_entitlement
from app.models.user import User
from app.schemas.ai import (
    POSSuggestionsResponse,
    RestockSuggestionsResponse,
    AssociationRulesResponse,
    NLQueryRequest,
    NLQueryResponse,
    AIBatchRunResponse,
)
from app.services.ai_service import (
    get_pos_smart_suggestions,
    compute_restock_forecasts,
    mine_association_rules_for_tenant,
    ask_ai_financial_assistant,
    run_ai_batch_job_for_tenant,
)

router = APIRouter(
    dependencies=[Depends(require_module_entitlement("ai_suggestions"))]
)


@router.get("/pos-suggestions", response_model=POSSuggestionsResponse)
async def get_pos_recommendations(
    cart_item_ids: Optional[List[str]] = Query(None),
    customer_id: Optional[str] = Query(None),
    limit: int = Query(6, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get live AI smart item recommendations for POS checkout.
    Uses a 3-tier cascade:
    1. Market basket cross-sell rules based on items currently in cart
    2. Customer frequent repeat purchases
    3. Global top-selling items fallback
    """
    return await get_pos_smart_suggestions(
        db=db,
        tenant_id=current_user.tenant_id,
        cart_item_ids=cart_item_ids or [],
        customer_id=customer_id,
        limit=limit,
    )


@router.get("/restock-suggestions", response_model=RestockSuggestionsResponse)
async def get_restock_recommendations(
    urgency: Optional[str] = Query(None, pattern="^(CRITICAL|WARNING|HEALTHY|ALL)$"),
    min_velocity: float = Query(0.0, ge=0.0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get predictive inventory restock & reorder recommendations with runout days and urgency.
    """
    return await compute_restock_forecasts(
        db=db,
        tenant_id=current_user.tenant_id,
        urgency_filter=urgency if urgency != "ALL" else None,
        min_velocity=min_velocity,
    )


@router.get("/association-rules", response_model=AssociationRulesResponse)
async def get_market_basket_rules(
    min_confidence: float = Query(0.1, ge=0.0, le=1.0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch mined market basket association rules (Support, Confidence, Lift) from sales transactions.
    """
    rules = await mine_association_rules_for_tenant(
        db=db,
        tenant_id=current_user.tenant_id,
        min_confidence=min_confidence,
    )
    return AssociationRulesResponse(
        total_rules=len(rules),
        rules=rules,
    )


@router.post("/ask", response_model=NLQueryResponse)
async def ask_financial_assistant(
    request: NLQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Natural Language Query Engine for financial, sales, inventory, and GST analytical queries.
    """
    return await ask_ai_financial_assistant(
        db=db,
        tenant_id=current_user.tenant_id,
        query_text=request.query,
    )


@router.post("/recompute-batch", response_model=AIBatchRunResponse)
async def trigger_ai_batch_recomputation(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually trigger AI intelligence cache recomputation for the tenant.
    """
    return await run_ai_batch_job_for_tenant(
        db=db,
        tenant_id=current_user.tenant_id,
    )

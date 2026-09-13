import csv
import io
import uuid
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status

from app.models.item import Item
from app.models.inventory import Godown, StockBatch
from app.models.party import Customer, Supplier, Area
from app.schemas.subscription import CSVImportSummaryResponse, CSVImportRowError


def _clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def _clean_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        s = str(val).strip().replace("₹", "").replace(",", "")
        return float(s)
    except (ValueError, TypeError):
        return default


async def _get_or_create_default_godown(db: AsyncSession, tenant_id: str) -> Godown:
    g_res = await db.execute(
        select(Godown).where(Godown.tenant_id == tenant_id, Godown.is_default == True)
    )
    godown = g_res.scalar_one_or_none()
    if not godown:
        g_first = await db.execute(select(Godown).where(Godown.tenant_id == tenant_id))
        godown = g_first.scalar_one_or_none()
    if not godown:
        godown = Godown(
            tenant_id=tenant_id,
            name="Main Store Godown",
            code="MAIN",
            is_default=True,
            is_active=True,
        )
        db.add(godown)
        await db.flush()
    return godown


async def import_items_from_csv(
    db: AsyncSession,
    tenant_id: str,
    csv_content: str,
) -> CSVImportSummaryResponse:
    """
    Bulk import products/items and initialize opening stock batches from CSV.
    """
    reader = csv.DictReader(io.StringIO(csv_content))
    success_count = 0
    failed_count = 0
    errors: List[CSVImportRowError] = []
    total_rows = 0

    default_godown = await _get_or_create_default_godown(db, tenant_id)

    # Pre-fetch existing barcodes
    existing_barcodes = set(
        (
            await db.execute(
                select(Item.barcode).where(
                    Item.tenant_id == tenant_id, Item.barcode != None
                )
            )
        )
        .scalars()
        .all()
    )

    for idx, row in enumerate(reader, start=2):  # 1-based, header is row 1
        total_rows += 1
        row_clean = {k.strip().lower(): v for k, v in row.items() if k}

        # Match columns flexibly
        name = (
            row_clean.get("item name")
            or row_clean.get("name")
            or row_clean.get("item_name")
            or row_clean.get("product name")
        )
        if not name or len(name.strip()) < 2:
            failed_count += 1
            errors.append(
                CSVImportRowError(
                    row_number=idx,
                    error="Item name is required (minimum 2 characters)",
                    raw_data=row,
                )
            )
            continue

        barcode = _clean_str(row_clean.get("barcode") or row_clean.get("barcode_number"))
        if barcode and barcode in existing_barcodes:
            failed_count += 1
            errors.append(
                CSVImportRowError(
                    row_number=idx,
                    error=f"Barcode '{barcode}' already exists for another product",
                    raw_data=row,
                )
            )
            continue

        sku = _clean_str(row_clean.get("sku") or row_clean.get("sku_code"))
        category = _clean_str(row_clean.get("category")) or "General"
        unit = (_clean_str(row_clean.get("unit")) or "PCS").upper()
        sale_price = _clean_float(
            row_clean.get("sale price")
            or row_clean.get("sale_price")
            or row_clean.get("selling price")
            or row_clean.get("mrp")
        )
        purchase_price = _clean_float(
            row_clean.get("purchase price")
            or row_clean.get("purchase_price")
            or row_clean.get("cost price")
        )
        gst_rate = _clean_float(
            row_clean.get("gst rate")
            or row_clean.get("gst_rate")
            or row_clean.get("tax rate")
            or row_clean.get("gst %"),
            default=0.0,
        )
        hsn_code = _clean_str(row_clean.get("hsn") or row_clean.get("hsn_code"))
        opening_stock = _clean_float(
            row_clean.get("opening stock")
            or row_clean.get("stock")
            or row_clean.get("quantity")
            or row_clean.get("qty")
        )

        try:
            item = Item(
                tenant_id=tenant_id,
                name=name.strip(),
                sku=sku,
                barcode=barcode,
                category=category,
                unit=unit,
                sale_price=sale_price,
                purchase_price=purchase_price,
                gst_rate=gst_rate,
                hsn_code=hsn_code,
                min_stock_alert=5.0,
                is_active=True,
            )
            db.add(item)
            await db.flush()

            if barcode:
                existing_barcodes.add(barcode)

            # If opening stock > 0, seed default batch
            if opening_stock > 0:
                batch = StockBatch(
                    tenant_id=tenant_id,
                    godown_id=default_godown.id,
                    item_id=item.id,
                    batch_number="OP-STOCK",
                    purchase_price=purchase_price,
                    sale_price=sale_price,
                    quantity=opening_stock,
                    is_active=True,
                )
                db.add(batch)

            success_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(
                CSVImportRowError(
                    row_number=idx,
                    error=f"Database error: {str(e)}",
                    raw_data=row,
                )
            )

    await db.commit()
    return CSVImportSummaryResponse(
        entity_type="items",
        total_rows=total_rows,
        success_count=success_count,
        failed_count=failed_count,
        errors=errors,
        message=f"Successfully imported {success_count} item(s) out of {total_rows} rows.",
    )


async def import_customers_from_csv(
    db: AsyncSession,
    tenant_id: str,
    csv_content: str,
) -> CSVImportSummaryResponse:
    """
    Bulk import customer parties and opening balances from CSV.
    """
    reader = csv.DictReader(io.StringIO(csv_content))
    success_count = 0
    failed_count = 0
    errors: List[CSVImportRowError] = []
    total_rows = 0

    existing_mobiles = set(
        (
            await db.execute(
                select(Customer.mobile).where(
                    Customer.tenant_id == tenant_id, Customer.mobile != None
                )
            )
        )
        .scalars()
        .all()
    )

    # Pre-fetch areas
    areas_map = {
        a.name.lower(): a.id
        for a in (
            await db.execute(select(Area).where(Area.tenant_id == tenant_id))
        )
        .scalars()
        .all()
    }

    for idx, row in enumerate(reader, start=2):
        total_rows += 1
        row_clean = {k.strip().lower(): v for k, v in row.items() if k}

        name = (
            row_clean.get("name")
            or row_clean.get("customer name")
            or row_clean.get("party name")
        )
        if not name or len(name.strip()) < 2:
            failed_count += 1
            errors.append(
                CSVImportRowError(
                    row_number=idx,
                    error="Customer name is required",
                    raw_data=row,
                )
            )
            continue

        mobile = _clean_str(row_clean.get("mobile") or row_clean.get("phone"))
        if mobile:
            digits = "".join(filter(str.isdigit, mobile))
            if len(digits) == 10:
                mobile = digits
            if mobile in existing_mobiles:
                failed_count += 1
                errors.append(
                    CSVImportRowError(
                        row_number=idx,
                        error=f"Customer with mobile '{mobile}' already exists",
                        raw_data=row,
                    )
                )
                continue

        gst_number = _clean_str(row_clean.get("gstin") or row_clean.get("gst_number") or row_clean.get("gst"))
        state = _clean_str(row_clean.get("state")) or "Maharashtra"
        address = _clean_str(row_clean.get("address"))
        area_name = _clean_str(row_clean.get("area") or row_clean.get("route"))
        opening_balance = _clean_float(
            row_clean.get("opening balance")
            or row_clean.get("opening_balance")
            or row_clean.get("balance")
        )

        area_id = None
        if area_name:
            area_key = area_name.lower()
            if area_key in areas_map:
                area_id = areas_map[area_key]
            else:
                new_area = Area(
                    tenant_id=tenant_id,
                    name=area_name,
                    code=area_name[:4].upper(),
                    is_active=True,
                )
                db.add(new_area)
                await db.flush()
                area_id = new_area.id
                areas_map[area_key] = area_id

        try:
            cust = Customer(
                tenant_id=tenant_id,
                name=name.strip(),
                mobile=mobile,
                gst_number=gst_number,
                state=state,
                address=address,
                area_id=area_id,
                opening_balance=opening_balance,
                current_balance=opening_balance,
            )
            db.add(cust)
            await db.flush()

            if mobile:
                existing_mobiles.add(mobile)

            success_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(
                CSVImportRowError(
                    row_number=idx,
                    error=f"Database error: {str(e)}",
                    raw_data=row,
                )
            )

    await db.commit()
    return CSVImportSummaryResponse(
        entity_type="customers",
        total_rows=total_rows,
        success_count=success_count,
        failed_count=failed_count,
        errors=errors,
        message=f"Successfully imported {success_count} customer(s) out of {total_rows} rows.",
    )


async def import_suppliers_from_csv(
    db: AsyncSession,
    tenant_id: str,
    csv_content: str,
) -> CSVImportSummaryResponse:
    """
    Bulk import supplier parties and opening balances from CSV.
    """
    reader = csv.DictReader(io.StringIO(csv_content))
    success_count = 0
    failed_count = 0
    errors: List[CSVImportRowError] = []
    total_rows = 0

    existing_mobiles = set(
        (
            await db.execute(
                select(Supplier.mobile).where(
                    Supplier.tenant_id == tenant_id, Supplier.mobile != None
                )
            )
        )
        .scalars()
        .all()
    )

    for idx, row in enumerate(reader, start=2):
        total_rows += 1
        row_clean = {k.strip().lower(): v for k, v in row.items() if k}

        name = (
            row_clean.get("name")
            or row_clean.get("supplier name")
            or row_clean.get("party name")
        )
        if not name or len(name.strip()) < 2:
            failed_count += 1
            errors.append(
                CSVImportRowError(
                    row_number=idx,
                    error="Supplier name is required",
                    raw_data=row,
                )
            )
            continue

        mobile = _clean_str(row_clean.get("mobile") or row_clean.get("phone"))
        if mobile:
            digits = "".join(filter(str.isdigit, mobile))
            if len(digits) == 10:
                mobile = digits
            if mobile in existing_mobiles:
                failed_count += 1
                errors.append(
                    CSVImportRowError(
                        row_number=idx,
                        error=f"Supplier with mobile '{mobile}' already exists",
                        raw_data=row,
                    )
                )
                continue

        gst_number = _clean_str(row_clean.get("gstin") or row_clean.get("gst_number") or row_clean.get("gst"))
        state = _clean_str(row_clean.get("state")) or "Maharashtra"
        address = _clean_str(row_clean.get("address"))
        opening_balance = _clean_float(
            row_clean.get("opening balance")
            or row_clean.get("opening_balance")
            or row_clean.get("balance")
        )

        try:
            supp = Supplier(
                tenant_id=tenant_id,
                name=name.strip(),
                mobile=mobile,
                gst_number=gst_number,
                state=state,
                address=address,
                opening_balance=opening_balance,
                current_balance=opening_balance,
            )
            db.add(supp)
            await db.flush()

            if mobile:
                existing_mobiles.add(mobile)

            success_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(
                CSVImportRowError(
                    row_number=idx,
                    error=f"Database error: {str(e)}",
                    raw_data=row,
                )
            )

    await db.commit()
    return CSVImportSummaryResponse(
        entity_type="suppliers",
        total_rows=total_rows,
        success_count=success_count,
        failed_count=failed_count,
        errors=errors,
        message=f"Successfully imported {success_count} supplier(s) out of {total_rows} rows.",
    )


def generate_sample_csv_template(entity_type: str) -> Tuple[str, str]:
    """
    Generate downloadable sample CSV templates with header and realistic rows.
    """
    entity = entity_type.lower().strip()
    if entity in ["item", "items", "products"]:
        filename = "Sample_Items_Import.csv"
        content = (
            "Name,SKU,Barcode,Category,Unit,Sale Price,Purchase Price,GST Rate,HSN Code,Opening Stock\n"
            "Fortune Sunlite Sunflower Oil 1L,OIL-001,8901234567890,Grocery,PCS,145.00,125.00,5.0,1512,50\n"
            "Tata Salt 1kg,SALT-001,8901234567891,Grocery,PCS,28.00,22.00,0.0,2501,100\n"
            "Dettol Original Soap 125g,SOAP-001,8901234567892,Personal Care,PCS,55.00,42.00,18.0,3401,60\n"
            "Cadbury Dairy Milk Silk 60g,CHOC-001,8901234567893,Confectionery,PCS,80.00,65.00,18.0,1806,30\n"
        )
    elif entity in ["customer", "customers"]:
        filename = "Sample_Customers_Import.csv"
        content = (
            "Name,Mobile,GSTIN,State,Address,Area,Opening Balance\n"
            "Ramesh General Store,9820000001,27AABCR1234A1Z5,Maharashtra,Shop 4 Market Road,North Market,2500.00\n"
            "Pooja Mini Mart,9820000002,,Maharashtra,Shop 12 High Street,Central Route,0.00\n"
            "Sai Supermarket,9820000003,27AAACS9999A1Z2,Maharashtra,Plot 88 Industrial Area,West Zone,8400.00\n"
        )
    elif entity in ["supplier", "suppliers"]:
        filename = "Sample_Suppliers_Import.csv"
        content = (
            "Name,Mobile,GSTIN,State,Address,Opening Balance\n"
            "Hindustan Unilever Distributor,9830000001,27AAACH1111A1Z5,Maharashtra,Depot Road Lower Parel,15000.00\n"
            "Adani Wilmar Depot,9830000002,27AAACA2222A1Z8,Maharashtra,Bhiwandi Godown Hub,35000.00\n"
            "ITC Foods Wholesale,9830000003,27AAAIT3333A1Z1,Maharashtra,Andheri East,0.00\n"
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown template type '{entity_type}'. Choose 'items', 'customers', or 'suppliers'.",
        )

    return filename, content

from pydantic import BaseModel
from typing import Optional, Any, Generic, TypeVar
from math import ceil

T = TypeVar("T")


class APIResponse(BaseModel):
    success: bool = True
    data: Optional[Any] = None
    message: Optional[str] = None
    error_code: Optional[str] = None


class PaginatedResponse(BaseModel):
    success: bool = True
    data: list = []
    message: Optional[str] = None
    pagination: dict = {}


def paginated_response(items: list, total: int, page: int, page_size: int) -> dict:
    return {
        "success": True,
        "data": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": ceil(total / page_size) if page_size > 0 else 1,
        },
    }


def success_response(data: Any = None, message: str = None) -> dict:
    return {"success": True, "data": data, "message": message}


def error_response(message: str, error_code: str = None) -> dict:
    return {"success": False, "data": None, "message": message, "error_code": error_code}

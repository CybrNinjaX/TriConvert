from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.services.converter import ConversionError, convert_model

router = APIRouter(tags=["conversion"])

SUPPORTED_FORMATS = {"obj", "stl", "glb", "gltf"}
MAX_FILE_SIZE = 100 * 1024 * 1024


@router.post("/convert")
async def convert(file: UploadFile = File(...), target_format: str = Form(...)):
    source_format = (file.filename or "").rsplit(".", 1)[-1].lower()
    target_format = target_format.lower().lstrip(".")

    if source_format not in SUPPORTED_FORMATS:
        raise HTTPException(400, "Unsupported input format. Use OBJ, STL, GLB, or GLTF.")
    if target_format not in SUPPORTED_FORMATS:
        raise HTTPException(400, "Unsupported output format. Use OBJ, STL, GLB, or GLTF.")
    if source_format == target_format:
        raise HTTPException(400, "Choose a different output format from the input format.")

    data = await file.read(MAX_FILE_SIZE + 1)
    if not data:
        raise HTTPException(400, "The uploaded file is empty.")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(413, "Files must be smaller than 100 MB.")

    try:
        converted, filename, media_type = convert_model(
            data, source_format, target_format, file.filename or "model"
        )
    except ConversionError as error:
        raise HTTPException(422, str(error)) from error
    finally:
        await file.close()

    return Response(
        content=converted,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

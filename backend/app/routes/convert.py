from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.services.converter import ConversionError, convert_model

router = APIRouter(tags=["conversion"])

SUPPORTED_FORMATS = {"obj", "stl", "glb", "gltf", "ply", "3mf", "fbx", "usdz"}
OUTPUT_FORMATS = {"obj", "stl", "glb", "gltf", "ply", "3mf"}
CONVERSION_PAIRS = {
    "glb": {"stl", "obj", "ply", "3mf"},
    "gltf": {"glb", "obj", "stl", "ply"},
    "obj": {"glb", "stl", "gltf", "ply"},
    "fbx": {"glb"},
    "stl": {"obj", "glb", "gltf", "ply"},
    "ply": {"stl", "obj", "glb", "gltf"},
    "3mf": {"stl", "obj", "glb", "gltf"},
    "usdz": {"glb"},
}
MAX_FILE_SIZE = 100 * 1024 * 1024


@router.post("/convert")
async def convert(file: UploadFile = File(...), target_format: str = Form(...)):
    source_format = (file.filename or "").rsplit(".", 1)[-1].lower()
    target_format = target_format.lower().lstrip(".")

    if source_format not in SUPPORTED_FORMATS:
        raise HTTPException(400, "Unsupported input format. Use OBJ, STL, GLB, GLTF, PLY, 3MF, FBX, or USDZ.")
    if target_format not in OUTPUT_FORMATS:
        raise HTTPException(400, "Unsupported output format. Use OBJ, STL, GLB, GLTF, PLY, or 3MF.")
    if target_format not in CONVERSION_PAIRS.get(source_format, set()):
        raise HTTPException(400, f"{source_format.upper()} to {target_format.upper()} is not a supported conversion.")

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

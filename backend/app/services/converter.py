from io import BytesIO
from pathlib import PurePath
import json
import zipfile

import trimesh


class ConversionError(Exception):
    """Raised when a model cannot be loaded or exported."""


def convert_model(data: bytes, source_format: str, target_format: str, original_name: str):
    try:
        scene = trimesh.load(
            file_obj=BytesIO(data), file_type=source_format, force="scene", process=False
        )
        if not isinstance(scene, trimesh.Scene) or not scene.geometry:
            raise ConversionError("No 3D geometry was found in this file.")

        exported = scene.export(file_type=target_format)
    except ConversionError:
        raise
    except Exception as error:
        raise ConversionError(
            "We couldn't read or convert this model. Check that the file is valid and try again."
        ) from error

    base_name = PurePath(original_name).stem or "converted-model"
    if target_format == "gltf":
        if isinstance(exported, str):
            exported = exported.encode("utf-8")
        if isinstance(exported, dict):
            archive = BytesIO()
            with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
                for name, content in exported.items():
                    if isinstance(content, str):
                        content = content.encode("utf-8")
                    bundle.writestr(name, content)
            return archive.getvalue(), f"{base_name}.zip", "application/zip"
        raise ConversionError("The GLTF exporter returned an unsupported result.")

    if isinstance(exported, str):
        exported = exported.encode("utf-8")
    if not isinstance(exported, bytes):
        raise ConversionError("The converter could not create the requested file.")

    media_types = {
        "obj": "text/plain",
        "stl": "model/stl",
        "glb": "model/gltf-binary",
    }
    return exported, f"{base_name}.{target_format}", media_types[target_format]

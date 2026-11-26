from io import BytesIO
from pathlib import PurePath
import os
import re
import shutil
import subprocess
import tempfile
import zipfile

import trimesh


class ConversionError(Exception):
    """Raised when a model cannot be loaded or exported."""


def convert_with_blender(data: bytes, source_format: str, original_name: str):
    blender = os.environ.get("BLENDER_EXECUTABLE", "blender")
    executable = shutil.which(blender)
    if not executable:
        raise ConversionError(
            "FBX and USDZ conversion needs Blender installed and available on PATH. "
            "Set BLENDER_EXECUTABLE to your Blender executable if needed."
        )

    suffix = f".{source_format}"
    base_name = re.sub(r"[^A-Za-z0-9._-]+", "_", PurePath(original_name).stem).strip("._") or "converted-model"
    with tempfile.TemporaryDirectory(prefix="triconvert-") as directory:
        source_path = os.path.join(directory, f"input{suffix}")
        output_path = os.path.join(directory, f"{base_name}.glb")
        with open(source_path, "wb") as source_file:
            source_file.write(data)

        if source_format == "fbx":
            import_statement = f"bpy.ops.import_scene.fbx(filepath={source_path!r})"
        else:
            import_statement = f"bpy.ops.wm.usd_import(filepath={source_path!r}, import_textures_mode='IMPORT_PACK')"
        script = (
            "import bpy; bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); "
            f"{import_statement}; "
            f"bpy.ops.export_scene.gltf(filepath={output_path!r}, export_format='GLB')"
        )
        try:
            result = subprocess.run(
                [executable, "--background", "--python-expr", script],
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            raise ConversionError("Blender took too long to convert this file.") from error
        if result.returncode != 0 or not os.path.exists(output_path):
            raise ConversionError("Blender couldn't read this model. Check that the file is valid and try again.")
        with open(output_path, "rb") as output_file:
            return output_file.read(), f"{base_name}.glb", "model/gltf-binary"


def convert_model(data: bytes, source_format: str, target_format: str, original_name: str):
    if source_format in {"fbx", "usdz"}:
        return convert_with_blender(data, source_format, original_name)

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

    base_name = re.sub(r"[^A-Za-z0-9._-]+", "_", PurePath(original_name).stem).strip("._")
    base_name = base_name or "converted-model"
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

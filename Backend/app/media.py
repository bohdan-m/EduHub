import uuid
from io import BytesIO
from urllib.parse import quote

from fastapi import HTTPException, Request, UploadFile, status
from PIL import Image

from app.config import get_settings
from app.schemas import MAX_IMAGE_BYTES, MAX_IMAGES

UPLOAD_DIR = "course_previews"
# Pillow-detected format -> extension we store under; the uploaded file name and content type are never trusted
ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "GIF": ".gif", "WEBP": ".webp"}


def _bad_image(message: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"uploaded_images: {message}")


def read_images(files: list[UploadFile]) -> list[tuple[bytes, str]]:
    """Validate every upload before anything is written; returns (bytes, extension) pairs."""
    if len(files) > MAX_IMAGES:
        raise _bad_image(f"Choose up to {MAX_IMAGES} images.")

    images = []
    for upload in files:
        name = upload.filename or "image"
        data = upload.file.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise _bad_image(f'"{name}" is over 5 MB.')
        try:
            with Image.open(BytesIO(data)) as image:
                image.verify()  # also rejects decompression bombs
                image_format = image.format
        except Exception as exc:
            raise _bad_image(f'"{name}" isn\'t a valid image.') from exc
        if image_format not in ALLOWED_FORMATS:
            raise _bad_image(f'"{name}" must be a JPEG, PNG, GIF or WebP image.')
        images.append((data, ALLOWED_FORMATS[image_format]))
    return images


def save_images(images: list[tuple[bytes, str]]) -> list[str]:
    """Write validated images under random names; returns paths relative to MEDIA_ROOT."""
    folder = get_settings().media_root / UPLOAD_DIR
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    try:
        for data, extension in images:
            relative = f"{UPLOAD_DIR}/{uuid.uuid4().hex}{extension}"
            (folder.parent / relative).write_bytes(data)
            saved.append(relative)
    except OSError:
        delete_images(saved)
        raise
    return saved


def delete_images(paths: list[str]) -> None:
    root = get_settings().media_root
    for relative in paths:
        # only files this API uploaded; the demo images shipped with the repo are left alone
        if relative.startswith(f"{UPLOAD_DIR}/"):
            (root / relative).unlink(missing_ok=True)


def media_url(request: Request, relative: str) -> str:
    return f"{str(request.base_url).rstrip('/')}/media/{quote(relative)}"

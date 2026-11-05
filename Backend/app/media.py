import uuid
from io import BytesIO
from pathlib import PurePath
from urllib.parse import quote

from fastapi import HTTPException, Request, UploadFile, status
from PIL import Image, ImageOps

from app.config import get_settings
from app.schemas import MAX_FILE_BYTES, MAX_IMAGE_BYTES, MAX_IMAGES

UPLOAD_DIR = "course_previews"
LESSON_DIR = "lesson_uploads"
# Pillow-detected formats we accept; the uploaded file name and content type are never trusted
ALLOWED_FORMATS = {"JPEG", "PNG", "GIF", "WEBP"}
COVER_SIDE, THUMB_SIDE, LESSON_IMAGE_SIDE = 1600, 480, 2000
THUMB_SUFFIX = "_thumb.webp"
# attachments: extension -> how the file must start (None: UTF-8 text without NUL bytes)
FILE_SIGNATURES: dict[str, bytes | None] = {
    "pdf": b"%PDF-",
    "zip": b"PK\x03\x04",
    "docx": b"PK\x03\x04",
    "xlsx": b"PK\x03\x04",
    "pptx": b"PK\x03\x04",
    "txt": None,
    "md": None,
    "csv": None,
}


def _bad_image(message: str, field: str = "uploaded_images") -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"{field}: {message}")


def _open_image(data: bytes, name: str, field: str) -> Image.Image:
    try:
        with Image.open(BytesIO(data)) as probe:
            probe.verify()  # also rejects decompression bombs
            image_format = probe.format
        image = Image.open(BytesIO(data))
        image.load()
    except Exception as exc:
        raise _bad_image(f'"{name}" isn\'t a valid image.', field) from exc
    if image_format not in ALLOWED_FORMATS:
        raise _bad_image(f'"{name}" must be a JPEG, PNG, GIF or WebP image.', field)
    return image


def _webp(image: Image.Image, max_side: int) -> bytes:
    """Re-encode as WebP no larger than max_side. Only pixels survive: EXIF (camera, GPS position) and other
    metadata are dropped, after the EXIF rotation is applied. Animated GIFs keep their first frame."""
    image = ImageOps.exif_transpose(image)
    image.thumbnail((max_side, max_side))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if image.mode in ("P", "LA", "PA") or "transparency" in image.info else "RGB")
    out = BytesIO()
    image.save(out, "WEBP", quality=82, method=4)
    return out.getvalue()


def read_images(files: list[UploadFile]) -> list[tuple[bytes, bytes]]:
    """Validate and re-encode every cover before anything is written; returns (image, thumbnail) pairs."""
    if len(files) > MAX_IMAGES:
        raise _bad_image(f"Choose up to {MAX_IMAGES} images.")

    images = []
    for upload in files:
        name = upload.filename or "image"
        data = upload.file.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise _bad_image(f'"{name}" is over 5 MB.')
        image = _open_image(data, name, "uploaded_images")
        images.append((_webp(image, COVER_SIDE), _webp(image, THUMB_SIDE)))
    return images


def save_images(images: list[tuple[bytes, bytes]]) -> list[str]:
    """Write re-encoded covers under random names; returns paths relative to MEDIA_ROOT."""
    folder = get_settings().media_root / UPLOAD_DIR
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    try:
        for data, thumb in images:
            name = uuid.uuid4().hex
            (folder / f"{name}.webp").write_bytes(data)
            (folder / f"{name}{THUMB_SUFFIX}").write_bytes(thumb)
            saved.append(f"{UPLOAD_DIR}/{name}.webp")
    except OSError:
        delete_images(saved)
        raise
    return saved


def thumbnail_path(relative: str) -> str:
    # covers uploaded before thumbnails existed (and the demo images) have none: cards use the image itself
    if relative.startswith(f"{UPLOAD_DIR}/") and relative.endswith(".webp") and not relative.endswith(THUMB_SUFFIX):
        return relative.removesuffix(".webp") + THUMB_SUFFIX
    return relative


def delete_images(paths: list[str]) -> None:
    root = get_settings().media_root
    for relative in paths:
        # only files this API uploaded; the demo images shipped with the repo are left alone
        if relative.startswith((f"{UPLOAD_DIR}/", f"{LESSON_DIR}/")):
            (root / relative).unlink(missing_ok=True)
            if thumbnail_path(relative) != relative:
                (root / thumbnail_path(relative)).unlink(missing_ok=True)


def save_lesson_upload(upload: UploadFile, kind: str) -> tuple[str, str, int]:
    """Validate and store an image or attachment for a lesson; returns (relative path, display name, size)."""
    name = PurePath(upload.filename or kind).name[:200] or kind
    limit = MAX_IMAGE_BYTES if kind == "image" else MAX_FILE_BYTES
    data = upload.file.read(limit + 1)
    if len(data) > limit:
        raise _bad_image(f'"{name}" is over {limit // (1024 * 1024)} MB.', "file")
    if not data:
        raise _bad_image(f'"{name}" is empty.', "file")

    if kind == "image":
        data, extension = _webp(_open_image(data, name, "file"), LESSON_IMAGE_SIDE), "webp"
    else:
        extension = PurePath(name).suffix.lower().lstrip(".")
        if extension not in FILE_SIGNATURES:
            raise _bad_image("Attach a PDF, ZIP, Word, Excel, PowerPoint, text, Markdown or CSV file.", "file")
        signature = FILE_SIGNATURES[extension]
        if signature is not None and not data.startswith(signature):
            raise _bad_image(f'"{name}" isn\'t a valid .{extension} file.', "file")
        if signature is None:
            try:
                if "\x00" in data.decode("utf-8"):
                    raise ValueError
            except ValueError as exc:
                raise _bad_image(f'"{name}" must be plain UTF-8 text.', "file") from exc

    folder = get_settings().media_root / LESSON_DIR
    folder.mkdir(parents=True, exist_ok=True)
    relative = f"{LESSON_DIR}/{uuid.uuid4().hex}.{extension}"
    (folder.parent / relative).write_bytes(data)
    return relative, name, len(data)


def media_url(request: Request, relative: str) -> str:
    return f"{str(request.base_url).rstrip('/')}/media/{quote(relative)}"

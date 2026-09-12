import os
from PIL import Image

logo_path = os.path.join("static", "images", "logo.png")
res_dir = os.path.join("android", "app", "src", "main", "res")

sizes = {
    "mipmap-mdpi": (48, 48),
    "mipmap-hdpi": (72, 72),
    "mipmap-xhdpi": (96, 96),
    "mipmap-xxhdpi": (144, 144),
    "mipmap-xxxhdpi": (192, 192)
}

if not os.path.exists(logo_path):
    print("Logo original no encontrado:", logo_path)
    exit(1)

img = Image.open(logo_path).convert("RGBA")

for folder, (w, h) in sizes.items():
    target_folder = os.path.join(res_dir, folder)
    if not os.path.exists(target_folder):
        os.makedirs(target_folder, exist_ok=True)
    
    resized = img.resize((w, h), Image.Resampling.LANCZOS)
    
    for filename in ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]:
        dest = os.path.join(target_folder, filename)
        resized.save(dest, "PNG")
        print(f"Generado {filename} ({w}x{h}) en {folder}")

print("✅ Todos los íconos de la aplicación Bibliotec fueron reemplazados exitosamente!")

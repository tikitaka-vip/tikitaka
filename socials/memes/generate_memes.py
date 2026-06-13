#!/usr/bin/env python3
"""Generate TikiTaka memes using Pillow with classic meme text overlay."""

from PIL import Image, ImageDraw, ImageFont
import textwrap
import os

MEME_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
CTA = "tikitaka.vip"


def get_font(size):
    return ImageFont.truetype(FONT_PATH, size)


def draw_outlined_text(draw, position, text, font, fill="white", outline="black", outline_width=3):
    """Draw text with black outline for meme-style readability."""
    x, y = position
    for dx in range(-outline_width, outline_width + 1):
        for dy in range(-outline_width, outline_width + 1):
            if dx != 0 or dy != 0:
                draw.text((x + dx, y + dy), text, font=font, fill=outline)
    draw.text((x, y), text, font=font, fill=fill)


def wrap_text(text, max_chars=25):
    return textwrap.fill(text, width=max_chars)


def add_cta(draw, img_width, img_height, font_size=18):
    """Add tikitaka.vip watermark in bottom-right corner."""
    font = get_font(font_size)
    bbox = draw.textbbox((0, 0), CTA, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = img_width - tw - 10
    y = img_height - th - 10
    draw_outlined_text(draw, (x, y), CTA, font, fill="#FFD700", outline="black", outline_width=2)


def generate_drake():
    """Drake: reject stats, approve monkey."""
    img = Image.open(os.path.join(MEME_DIR, "drake.jpg"))
    draw = ImageDraw.Draw(img)
    w, h = img.size

    # Text goes on the right side of the Drake meme
    right_x = w // 2 + 10
    text_w = w // 2 - 20

    font_size = max(20, w // 28)
    font = get_font(font_size)

    # Top text (reject)
    top_text = wrap_text("Spending hours on stats and analysis", max_chars=22)
    draw_outlined_text(draw, (right_x, h // 8), top_text, font)

    # Bottom text (approve)
    bot_text = wrap_text("A monkey picking via zoo webcam", max_chars=22)
    draw_outlined_text(draw, (right_x, h // 2 + h // 8), bot_text, font)

    add_cta(draw, w, h)
    out = os.path.join(MEME_DIR, "01-drake-monkey-picks.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


def generate_two_buttons():
    """Two Buttons: safe pick vs upset."""
    img = Image.open(os.path.join(MEME_DIR, "two-buttons.jpg"))
    draw = ImageDraw.Draw(img)
    w, h = img.size

    font_size = max(16, w // 25)
    font = get_font(font_size)

    # Button labels near top
    draw_outlined_text(draw, (w // 10, h // 12), wrap_text("Predict the safe\nfavorite", 20), font)
    draw_outlined_text(draw, (w // 2 + 10, h // 12), wrap_text("Predict the upset\nfor 8x points", 20), font)

    # Caption at bottom
    caption_font = get_font(font_size + 4)
    caption = "Every match on TikiTaka."
    bbox = draw.textbbox((0, 0), caption, font=caption_font)
    tw = bbox[2] - bbox[0]
    draw_outlined_text(draw, ((w - tw) // 2, h - h // 5), caption, caption_font, fill="#FFD700")

    add_cta(draw, w, h)
    out = os.path.join(MEME_DIR, "02-two-buttons-upset.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


def generate_expanding_brain():
    """Galaxy Brain: 4 levels of prediction."""
    img = Image.open(os.path.join(MEME_DIR, "expanding-brain.jpg"))
    draw = ImageDraw.Draw(img)
    w, h = img.size

    font_size = max(16, w // 25)
    font = get_font(font_size)

    texts = [
        "Predict with your heart",
        "Predict by FIFA ranking",
        "Predict by betting odds",
        "Just copy the monkey",
    ]

    # Each panel is roughly h/4 tall, text on the left side
    for i, text in enumerate(texts):
        y = i * (h // 4) + (h // 8) - font_size
        wrapped = wrap_text(text, max_chars=20)
        fill = "#FFD700" if i == 3 else "white"
        draw_outlined_text(draw, (10, y), wrapped, font, fill=fill)

    add_cta(draw, w, h)
    out = os.path.join(MEME_DIR, "03-galaxy-brain-monkey.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


def generate_distracted_bf():
    """Distracted Boyfriend: me, my system, what monkey picked."""
    img = Image.open(os.path.join(MEME_DIR, "distracted-bf.jpg"))
    draw = ImageDraw.Draw(img)
    w, h = img.size

    font_size = max(18, w // 25)
    font = get_font(font_size)

    # Labels for each person (approximate positions)
    # Passing girl (left)
    draw_outlined_text(draw, (w // 20, h * 2 // 3), wrap_text("What the monkey picked", 16), font, fill="#FFD700")

    # Boyfriend (center)
    draw_outlined_text(draw, (w * 2 // 5, h * 2 // 3), "Me", font)

    # Girlfriend (right)
    draw_outlined_text(draw, (w * 3 // 4, h * 2 // 3), wrap_text("My 'scientific' system", 14), font)

    add_cta(draw, w, h)
    out = os.path.join(MEME_DIR, "04-distracted-bf-monkey.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


def generate_this_is_fine():
    """This Is Fine: last in league, monkey ahead."""
    img = Image.open(os.path.join(MEME_DIR, "this-is-fine.jpg"))
    draw = ImageDraw.Draw(img)
    w, h = img.size

    font_size = max(18, w // 22)
    font = get_font(font_size)

    # Top text
    top = "Me, last in my league"
    bbox = draw.textbbox((0, 0), top, font=font)
    tw = bbox[2] - bbox[0]
    draw_outlined_text(draw, ((w - tw) // 2, 5), top, font)

    # Middle caption
    mid = "The monkey is 3 pts ahead"
    bbox = draw.textbbox((0, 0), mid, font=font)
    tw = bbox[2] - bbox[0]
    draw_outlined_text(draw, ((w - tw) // 2, h // 3), mid, font, fill="#FFD700")

    # Bottom
    bottom_font = get_font(font_size + 6)
    bottom = "This is fine."
    bbox = draw.textbbox((0, 0), bottom, font=bottom_font)
    tw = bbox[2] - bbox[0]
    draw_outlined_text(draw, ((w - tw) // 2, h - h // 4), bottom, bottom_font)

    add_cta(draw, w, h)
    out = os.path.join(MEME_DIR, "05-this-is-fine-monkey.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


def generate_surprised_pikachu():
    """Surprised Pikachu: predicted safe, finished below monkey."""
    img = Image.open(os.path.join(MEME_DIR, "surprised-pikachu.jpg"))
    draw = ImageDraw.Draw(img)
    w, h = img.size

    font_size = max(20, w // 20)
    font = get_font(font_size)

    # Top text
    top = wrap_text("Only predicted safe favorites", 22)
    bbox = draw.textbbox((0, 0), top, font=font)
    tw = bbox[2] - bbox[0]
    draw_outlined_text(draw, ((w - tw) // 2, 10), top, font)

    # Bottom text
    bottom = wrap_text("Finished below the monkey", 22)
    bbox = draw.textbbox((0, 0), bottom, font=font)
    tw = bbox[2] - bbox[0]
    draw_outlined_text(draw, ((w - tw) // 2, h - h // 5), bottom, font, fill="#FFD700")

    add_cta(draw, w, h)
    out = os.path.join(MEME_DIR, "06-surprised-pikachu-monkey.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


def generate_spoiler_upset():
    """Spoiler upset meme using Drake template as base (top/bottom format)."""
    img = Image.open(os.path.join(MEME_DIR, "drake.jpg"))
    draw = ImageDraw.Draw(img)
    w, h = img.size

    font_size = max(18, w // 24)
    font = get_font(font_size)

    right_x = w // 2 + 10

    top_text = wrap_text("Experts: France wins 2-0", max_chars=20)
    draw_outlined_text(draw, (right_x, h // 8), top_text, font)

    bot_text = wrap_text("The monkey: Brazil upset 3-1 = 40 pts", max_chars=20)
    draw_outlined_text(draw, (right_x, h // 2 + h // 8), bot_text, font, fill="#FFD700")

    add_cta(draw, w, h)
    out = os.path.join(MEME_DIR, "07-spoiler-upset-monkey.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


def generate_party_corner():
    """They don't know - guy at party (using This Is Fine as base with overlay text)."""
    # Using a simple text-on-image approach since we don't have the party template
    img = Image.new("RGB", (800, 600), "#1a1a2e")
    draw = ImageDraw.Draw(img)

    font_big = get_font(32)
    font_small = get_font(22)

    # Title
    title = "They don't know..."
    bbox = draw.textbbox((0, 0), title, font=font_big)
    tw = bbox[2] - bbox[0]
    draw.text(((800 - tw) // 2, 50), title, font=font_big, fill="white")

    # Main text
    main_text = wrap_text("I'm in a private league against a monkey on tikitaka.vip", 30)
    bbox = draw.textbbox((0, 0), main_text, font=font_small)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((800 - tw) // 2, (600 - th) // 2), main_text, font=font_small, fill="#FFD700")

    # Emoji stand-in
    monkey = "[ guy alone at party ]"
    bbox = draw.textbbox((0, 0), monkey, font=font_small)
    tw = bbox[2] - bbox[0]
    draw.text(((800 - tw) // 2, 450), monkey, font=font_small, fill="#888888")

    add_cta(draw, 800, 600)
    out = os.path.join(MEME_DIR, "09-they-dont-know-monkey.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


def generate_monkey_pov():
    """Monkey POV selfie meme - text card."""
    img = Image.new("RGB", (800, 600), "#0e4429")
    draw = ImageDraw.Draw(img)

    font_big = get_font(36)
    font_small = get_font(24)

    # Main text
    main = "POV: you're in 2nd place"
    bbox = draw.textbbox((0, 0), main, font=font_big)
    tw = bbox[2] - bbox[0]
    draw.text(((800 - tw) // 2, 150), main, font=font_big, fill="white")

    sub = "...below me"
    bbox = draw.textbbox((0, 0), sub, font=font_big)
    tw = bbox[2] - bbox[0]
    draw.text(((800 - tw) // 2, 220), sub, font=font_big, fill="#FFD700")

    # Monkey emoji stand-in
    emoji_text = "[ monkey with sunglasses ]"
    bbox = draw.textbbox((0, 0), emoji_text, font=font_small)
    tw = bbox[2] - bbox[0]
    draw.text(((800 - tw) // 2, 380), emoji_text, font=font_small, fill="#888888")

    add_cta(draw, 800, 600)
    out = os.path.join(MEME_DIR, "10-monkey-pov-selfie.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


def generate_gigachad_mock():
    """Gigachad/mocking meme - text card since no template."""
    img = Image.new("RGB", (800, 600), "#1a0a2e")
    draw = ImageDraw.Draw(img)

    font_big = get_font(30)
    font_small = get_font(24)

    top = wrap_text('"You said you\'d beat the monkey easily?"', 30)
    bbox = draw.textbbox((0, 0), top, font=font_big)
    tw = bbox[2] - bbox[0]
    draw.text(((800 - tw) // 2, 100), top, font=font_big, fill="white")

    bottom = "Mhm. Sure."
    bbox = draw.textbbox((0, 0), bottom, font=font_big)
    tw = bbox[2] - bbox[0]
    draw.text(((800 - tw) // 2, 350), bottom, font=font_big, fill="#FFD700")

    note = "[ sunglasses monkey ]"
    bbox = draw.textbbox((0, 0), note, font=font_small)
    tw = bbox[2] - bbox[0]
    draw.text(((800 - tw) // 2, 430), note, font=font_small, fill="#888888")

    add_cta(draw, 800, 600)
    out = os.path.join(MEME_DIR, "06b-gigachad-monkey.jpg")
    img.save(out, quality=92)
    print(f"  Saved: {out}")


if __name__ == "__main__":
    print("Generating TikiTaka memes...")
    generate_drake()
    generate_two_buttons()
    generate_expanding_brain()
    generate_distracted_bf()
    generate_this_is_fine()
    generate_surprised_pikachu()
    generate_spoiler_upset()
    generate_gigachad_mock()
    generate_party_corner()
    generate_monkey_pov()
    print("\nDone! All memes saved to:", MEME_DIR)

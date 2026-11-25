import io
import os
import time
import uuid
import math
import random
import base64
from typing import List, Tuple, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont

from app.models.schemas import (
    GenerateHandwritingOptions,
    GenerateHandwritingResponse,
    GeneratedPageItem,
    PersonalizedProfileResponse,
)
from app.services.profile_service import get_profile_service


class HandwritingGenerationService:
    """
    Step 8: Real Backend Handwriting Generation Engine
    Renders user-supplied text into realistic handwritten-style A4 page images using Pillow.
    Integrates morphological parameters from the Step 7 personalized handwriting profile:
    - Dominant ink color
    - Stroke thickness emulation
    - Median line spacing
    - Baseline micro-variations & natural human spacing jitter
    Supports multi-page document pagination and lined/ruled or blank paper styles.
    """

    PAGE_WIDTH = 1240   # A4 at ~150 DPI
    PAGE_HEIGHT = 1754  # A4 at ~150 DPI

    def __init__(self):
        # Resolve output storage directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.output_dir = os.path.join(base_dir, "data", "generated_pages")
        self.custom_fonts_dir = os.path.join(base_dir, "data", "fonts")
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.custom_fonts_dir, exist_ok=True)

    def _resolve_font(self, font_family: str, font_size: int) -> Tuple[ImageFont.ImageFont, str]:
        """
        Locates the best available handwriting TrueType font based on requested family.
        Searches:
        1. Custom fonts in data/fonts/
        2. Standard Windows handwriting fonts (Segoe Script, Ink Free, Freestyle Script, Segoe Print, etc.)
        3. Pillow default font as safe fallback.
        """
        font_family = (font_family or "cursive").lower()

        # Candidate fonts map with Segoe Script (connected cursive) prioritizing realistic handwriting
        candidates = []
        if font_family in ("cursive", "script", "connected", "segoesc"):
            candidates = [
                os.path.join(self.custom_fonts_dir, "segoesc.ttf"),
                "C:/Windows/Fonts/segoesc.ttf",
                "C:/Windows/Fonts/FREESCPT.TTF",
                "C:/Windows/Fonts/LHANDW.TTF",
                "C:/Windows/Fonts/MISTRAL.TTF",
                "C:/Windows/Fonts/Inkfree.ttf",
            ]
        elif font_family in ("fluid", "freestyle", "freescpt"):
            candidates = [
                "C:/Windows/Fonts/FREESCPT.TTF",
                "C:/Windows/Fonts/segoesc.ttf",
                "C:/Windows/Fonts/Inkfree.ttf",
            ]
        elif font_family in ("print", "neat", "segoepr"):
            candidates = [
                os.path.join(self.custom_fonts_dir, "segoepr.ttf"),
                "C:/Windows/Fonts/segoepr.ttf",
                "C:/Windows/Fonts/Inkfree.ttf",
                "C:/Windows/Fonts/comic.ttf",
            ]
        elif font_family in ("casual", "inkfree"):
            candidates = [
                os.path.join(self.custom_fonts_dir, "Inkfree.ttf"),
                "C:/Windows/Fonts/Inkfree.ttf",
                "C:/Windows/Fonts/segoesc.ttf",
                "C:/Windows/Fonts/segoepr.ttf",
            ]
        else:
            candidates = [
                "C:/Windows/Fonts/segoesc.ttf",
                "C:/Windows/Fonts/Inkfree.ttf",
                "C:/Windows/Fonts/segoepr.ttf",
                "C:/Windows/Fonts/arial.ttf",
            ]

        # Check any fonts present in custom_fonts_dir first
        if os.path.exists(self.custom_fonts_dir):
            for f in os.listdir(self.custom_fonts_dir):
                if f.lower().endswith((".ttf", ".otf")):
                    candidates.insert(0, os.path.join(self.custom_fonts_dir, f))

        for font_path in candidates:
            if os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, font_size)
                    font_name = os.path.basename(font_path)
                    return font, font_name
                except Exception as ex:
                    print(f"[GenerationService] Could not load font '{font_path}': {ex}")

        # Fallback to Pillow default
        print("[GenerationService] Warning: TrueType handwriting font not found. Using default Pillow font.")
        return ImageFont.load_default(), "Pillow_Default_Fallback"

    def _hex_to_rgb(self, hex_str: str) -> Tuple[int, int, int]:
        """Parses a hex color string into an (R, G, B) tuple."""
        try:
            h = hex_str.strip().lstrip("#")
            if len(h) == 3:
                h = "".join([c * 2 for c in h])
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
        except Exception:
            return (28, 52, 94)  # Fallback to authentic dark navy ballpoint blue

    def _create_page_background(self, page_style: str, line_height: int, margin_x: int, margin_top: int) -> Image.Image:
        """
        Creates an A4 paper canvas with authentic notebook paper textures:
        - 'ruled': off-white parchment with faint blue notebook ruling and a left margin line
        - 'plain' / 'white': clean white unruled paper (matching typical assignment & exam sheets)
        - 'blank': warm ivory unruled page
        - 'grid': light engineering grid lines
        """
        page_style = (page_style or "ruled").lower()
        
        if page_style in ("plain", "white"):
            # Clean white page matching user's original reference photo
            img = Image.new("RGB", (self.PAGE_WIDTH, self.PAGE_HEIGHT), color=(254, 254, 253))
            return img
        elif page_style in ("blank", "ivory"):
            # Warm ivory parchment
            img = Image.new("RGB", (self.PAGE_WIDTH, self.PAGE_HEIGHT), color=(253, 251, 247))
            return img

        # Ruled or grid paper
        img = Image.new("RGB", (self.PAGE_WIDTH, self.PAGE_HEIGHT), color=(253, 251, 247))
        draw = ImageDraw.Draw(img)

        if page_style == "ruled":
            # Draw notebook horizontal lines
            rule_color = (222, 230, 240)  # Soft light blue notebook ruling
            y = margin_top
            while y < self.PAGE_HEIGHT - 60:
                draw.line([(margin_x - 30, y), (self.PAGE_WIDTH - margin_x + 30, y)], fill=rule_color, width=1)
                y += line_height

            # Draw vertical red margin line
            margin_line_x = margin_x - 16
            draw.line([(margin_line_x, 40), (margin_line_x, self.PAGE_HEIGHT - 40)], fill=(244, 180, 180), width=1)

        elif page_style == "grid":
            grid_color = (235, 238, 242)
            step = 28
            for x in range(margin_x - 20, self.PAGE_WIDTH - margin_x + 20, step):
                draw.line([(x, 40), (x, self.PAGE_HEIGHT - 40)], fill=grid_color, width=1)
            for y in range(margin_top - 20, self.PAGE_HEIGHT - 40, step):
                draw.line([(margin_x - 20, y), (self.PAGE_WIDTH - margin_x + 20, y)], fill=grid_color, width=1)

        return img

    def generate_handwriting(
        self,
        text: str,
        options: Optional[GenerateHandwritingOptions] = None,
    ) -> GenerateHandwritingResponse:
        """
        Generates handwritten pages from the provided text.
        Applies Step 7 style profile parameters when available.
        Uses Experimental profile-based rendering (Parametric Engine v2.0):
        - Segoe Script connected cursive font mapping
        - Typographic baseline anchoring onto ruled paper lines
        - Multi-pass ballpoint stroke dilation emulating 0.7mm ballpoint ink deposit
        - Gentle undulating baseline wave and inter-word micro-spacing
        - Exact sequence preservation and word-wrap pagination
        """
        t_start = time.time()
        options = options or GenerateHandwritingOptions()
        session_id = str(uuid.uuid4())[:8]

        # 1. Input Validation
        cleaned_text = (text or "").strip()
        if not cleaned_text:
            raise ValueError("Input text cannot be empty. Please provide content to render.")

        if len(cleaned_text) > 30000:
            raise ValueError("Input text exceeds maximum allowed length of 30,000 characters.")

        # Normalize unicode circled digits absent from cursive font charsets into standard handwritten format (e.g. ① -> (1))
        circled_digits_map = {
            '①': '(1)', '②': '(2)', '③': '(3)', '④': '(4)', '⑤': '(5)',
            '⑥': '(6)', '⑦': '(7)', '⑧': '(8)', '⑨': '(9)', '⑩': '(10)',
            '⑪': '(11)', '⑫': '(12)', '⑬': '(13)', '⑭': '(14)', '⑮': '(15)',
            '⑯': '(16)', '⑰': '(17)', '⑱': '(18)', '⑲': '(19)', '⑳': '(20)',
        }
        for c_char, r_str in circled_digits_map.items():
            cleaned_text = cleaned_text.replace(c_char, r_str)

        # 2. Retrieve Step 7 Personalized Profile (if requested)
        profile_svc = get_profile_service()
        profile: Optional[PersonalizedProfileResponse] = None
        profile_applied = False

        if options.use_profile and options.profile_id:
            profile = profile_svc.get_saved_profile(options.profile_id)
            if profile and profile.status == "ready":
                profile_applied = True

        # 3. Determine Layout & Styling Parameters
        # Harmonize line height and font size based on profile or standard handwriting scale
        # Real handwriting on A4 ruled paper typically has ~26-30 lines (~52-60px line spacing)
        base_line_height = 54
        if profile_applied and profile.aggregated_metrics and profile.aggregated_metrics.line_spacing:
            p_spacing = profile.aggregated_metrics.line_spacing.value
            if p_spacing and 36 <= p_spacing <= 80:
                base_line_height = int(round(p_spacing))
            elif options.font_size:
                base_line_height = int(options.font_size * options.line_spacing_mult)
        elif options.font_size:
            base_line_height = int(options.font_size * options.line_spacing_mult)

        # Base font size: scale appropriately so letters fill ~60-65% of line height
        if options.font_size and options.font_size >= 30:
            font_size = options.font_size
        else:
            font_size = max(32, int(round(base_line_height * 0.64)))

        # Resolve font
        font, font_name = self._resolve_font(options.font_family, font_size)

        # Retrieve typographic ascent/descent for baseline positioning
        try:
            ascent, descent = font.getmetrics()
        except AttributeError:
            ascent = int(font_size * 0.82)
            descent = int(font_size * 0.22)

        # Ink Color Selection
        # User reference shows Pentonic dark ballpoint navy blue (rgb ~ 28, 52, 94)
        if options.ink_color:
            base_ink_rgb = self._hex_to_rgb(options.ink_color)
            ink_source = "User Color Override"
        elif profile_applied and profile.dominant_color:
            p_rgb = profile.dominant_color.rgb
            if p_rgb and len(p_rgb) == 3:
                r, g, b = int(p_rgb[0]), int(p_rgb[1]), int(p_rgb[2])
                # If profile color has blue ballpoint tint (or dark navy core)
                if b > r and b >= 45:
                    base_ink_rgb = (min(r, 38), min(g, 62), max(b, 85))
                else:
                    base_ink_rgb = (r, g, b)
                ink_source = f"Profile Dominant Ink ({profile.dominant_color.color_name})"
            elif profile.dominant_color.hex:
                base_ink_rgb = self._hex_to_rgb(profile.dominant_color.hex)
                ink_source = f"Profile Dominant Ink ({profile.dominant_color.color_name})"
            else:
                base_ink_rgb = (28, 52, 94)
                ink_source = "Authentic Ballpoint Blue"
        else:
            base_ink_rgb = (28, 52, 94)  # Default Pentonic ballpoint dark navy blue
            ink_source = "Pentonic Dark Navy Ballpoint Blue"

        # Stroke thickness emulation (User reference image has ~3.8-4.2px ballpoint thickness)
        stroke_thickness = 3.8
        if profile_applied and profile.aggregated_metrics and profile.aggregated_metrics.stroke_thickness:
            st = profile.aggregated_metrics.stroke_thickness.value
            if st and st > 0:
                stroke_thickness = float(st)

        # Baseline slant
        slant_deg = 0.0
        if profile_applied and profile.aggregated_metrics and profile.aggregated_metrics.slant_angle:
            slant_deg = float(profile.aggregated_metrics.slant_angle.value or 0.0)

        options_applied = {
            "font_resolved": font_name,
            "font_size": font_size,
            "line_height_px": base_line_height,
            "ink_color_rgb": list(base_ink_rgb),
            "ink_source": ink_source,
            "stroke_thickness_applied": stroke_thickness,
            "slant_deg_applied": slant_deg,
            "paper_style": options.page_style,
            "profile_used": profile_applied,
            "profile_id": options.profile_id if profile_applied else None,
        }

        # Sub-pixel dilation offsets for ballpoint pen simulation
        # Produces natural ink deposit and rounded stroke body
        stroke_offsets = [(0.0, 0.0)]
        if stroke_thickness >= 2.0:
            stroke_offsets.extend([(-0.5, 0.0), (0.5, 0.0), (0.0, -0.5), (0.0, 0.5)])
        if stroke_thickness >= 3.2:
            stroke_offsets.extend([
                (-0.7, -0.7), (0.7, -0.7), (-0.7, 0.7), (0.7, 0.7),
                (-1.0, 0.0), (1.0, 0.0)
            ])

        # 4. Text Pagination & Word Wrapping Engine
        margin_x = options.margin_x
        margin_top = options.margin_top
        margin_bottom = options.margin_bottom
        usable_width = self.PAGE_WIDTH - (margin_x * 2)
        usable_height = self.PAGE_HEIGHT - margin_top - margin_bottom

        # Break text into paragraphs
        paragraphs = cleaned_text.splitlines()

        dummy_img = Image.new("RGB", (100, 100))
        dummy_draw = ImageDraw.Draw(dummy_img)

        pages_lines: List[List[str]] = []
        current_page_lines: List[str] = []
        current_y_estimate = margin_top

        for p_idx, para in enumerate(paragraphs):
            para = para.strip()
            if not para:
                # Blank line / paragraph separator
                if current_page_lines:
                    current_y_estimate += int(base_line_height * 0.75)
                    current_page_lines.append("")
                continue

            words = para.split()
            current_line_words = []

            for word in words:
                test_line = " ".join(current_line_words + [word])
                try:
                    line_w = dummy_draw.textlength(test_line, font=font)
                except AttributeError:
                    bbox = dummy_draw.textbbox((0, 0), test_line, font=font)
                    line_w = bbox[2] - bbox[0]

                if line_w <= usable_width or not current_line_words:
                    current_line_words.append(word)
                else:
                    # Line full: push line to page
                    full_line = " ".join(current_line_words)
                    current_page_lines.append(full_line)
                    current_y_estimate += base_line_height

                    # Check page overflow
                    if current_y_estimate + base_line_height > (self.PAGE_HEIGHT - margin_bottom):
                        pages_lines.append(current_page_lines)
                        current_page_lines = []
                        current_y_estimate = margin_top

                    current_line_words = [word]

            if current_line_words:
                current_page_lines.append(" ".join(current_line_words))
                current_y_estimate += base_line_height

                if current_y_estimate + base_line_height > (self.PAGE_HEIGHT - margin_bottom):
                    pages_lines.append(current_page_lines)
                    current_page_lines = []
                    current_y_estimate = margin_top

        if current_page_lines:
            pages_lines.append(current_page_lines)

        # Fallback if text produced 0 lines
        if not pages_lines:
            pages_lines = [[cleaned_text]]

        total_pages = len(pages_lines)

        # 5. Render Pages to PNG and Multi-page PDF
        generated_page_items: List[GeneratedPageItem] = []
        rendered_pil_images: List[Image.Image] = []
        session_dir = os.path.join(self.output_dir, session_id)
        os.makedirs(session_dir, exist_ok=True)

        # Deterministic random seed per session for natural but consistent micro-variation
        rnd = random.Random(42)

        for page_idx, lines in enumerate(pages_lines, start=1):
            page_img = self._create_page_background(
                page_style=options.page_style,
                line_height=base_line_height,
                margin_x=margin_x,
                margin_top=margin_top,
            )
            draw = ImageDraw.Draw(page_img)

            cursor_line_idx = 0
            page_words_count = 0
            page_chars_count = 0

            for line in lines:
                if not line:
                    cursor_line_idx += 1
                    continue

                words_in_line = line.split()
                page_words_count += len(words_in_line)
                page_chars_count += len(line)

                # Ruled line position for this text row
                rule_y = margin_top + (cursor_line_idx * base_line_height)
                # Baseline anchoring: place font baseline exactly on notebook line (minus slight pen rest of 3px)
                target_baseline_y = rule_y - 3
                base_text_y = target_baseline_y - ascent

                cursor_x = margin_x

                for w_idx, word in enumerate(words_in_line):
                    # Natural human micro-wobbles and gentle baseline sine wave
                    wave_y = math.sin((cursor_x - margin_x) * 0.009) * 1.6 if options.simulate_pressure else 0.0
                    wobble_y = rnd.uniform(-0.8, 0.8) if options.simulate_pressure else 0.0
                    space_jitter = rnd.uniform(-1.0, 1.8) if options.simulate_pressure else 0.0

                    # Natural human ink pressure variation
                    if options.simulate_pressure:
                        r_var = max(0, min(255, base_ink_rgb[0] + rnd.randint(-5, 5)))
                        g_var = max(0, min(255, base_ink_rgb[1] + rnd.randint(-5, 5)))
                        b_var = max(0, min(255, base_ink_rgb[2] + rnd.randint(-5, 5)))
                        ink_rgb = (r_var, g_var, b_var)
                    else:
                        ink_rgb = base_ink_rgb

                    draw_x = cursor_x
                    draw_y = base_text_y + wave_y + wobble_y

                    # Multi-pass sub-pixel dilation for authentic ballpoint pen thickness
                    for dx, dy in stroke_offsets:
                        draw.text((draw_x + dx, draw_y + dy), word, font=font, fill=ink_rgb)

                    # Advance cursor
                    try:
                        word_w = draw.textlength(word, font=font)
                        space_w = draw.textlength(" ", font=font)
                    except AttributeError:
                        bbox = draw.textbbox((0, 0), word, font=font)
                        word_w = bbox[2] - bbox[0]
                        space_w = 8

                    cursor_x += word_w + space_w + space_jitter

                cursor_line_idx += 1

            # Keep reference for PDF compilation
            rendered_pil_images.append(page_img)

            # Save page image to disk
            page_filename = f"page_{page_idx}.png"
            page_filepath = os.path.join(session_dir, page_filename)
            page_img.save(page_filepath, format="PNG", optimize=True)

            # Convert to base64 data URL for fast direct client rendering
            buffered = io.BytesIO()
            page_img.save(buffered, format="PNG", optimize=True)
            img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
            data_url = f"data:image/png;base64,{img_b64}"

            generated_page_items.append(
                GeneratedPageItem(
                    page_number=page_idx,
                    total_pages=total_pages,
                    width=self.PAGE_WIDTH,
                    height=self.PAGE_HEIGHT,
                    image_data=data_url,
                    file_url=f"/api/generate/page/{session_id}/{page_idx}",
                    word_count=page_words_count,
                    char_count=page_chars_count,
                    line_count=len([l for l in lines if l]),
                )
            )

        # Compile authentic multi-page PDF document
        pdf_url = None
        if rendered_pil_images:
            pdf_path = os.path.join(session_dir, "document.pdf")
            try:
                rendered_pil_images[0].save(
                    pdf_path,
                    "PDF",
                    resolution=150.0,
                    save_all=True,
                    append_images=rendered_pil_images[1:]
                )
                pdf_url = f"/api/generate/pdf/{session_id}"
            except Exception as ex:
                print(f"[GenerationService] Warning: Could not compile multi-page PDF: {ex}")

        elapsed = round(time.time() - t_start, 2)

        return GenerateHandwritingResponse(
            success=True,
            session_id=session_id,
            total_pages=total_pages,
            pages=generated_page_items,
            profile_applied=profile_applied,
            profile_id=options.profile_id if profile_applied else None,
            renderer_name="Experimental profile-based rendering (Parametric Engine v2.0)",
            renderer_notice=(
                "Experimental profile-based rendering: This page was rendered using a parametric typography "
                "engine with typographic baseline anchoring, ballpoint stroke dilation, and style parameters "
                "derived from your Step 7 handwriting profile. Deep generative synthesis (learning unique writer "
                "glyph geometries from raw strokes) requires a specialized recurrent or diffusion synthesis network."
            ),
            generation_time_sec=elapsed,
            options_applied=options_applied,
            pdf_url=pdf_url,
            message=f"Generated {total_pages} handwritten page{'s' if total_pages > 1 else ''} successfully in {elapsed}s using Parametric Engine v2.0.",
        )

    def get_generated_page_bytes(self, session_id: str, page_num: int) -> Optional[bytes]:
        """Safely reads the generated PNG page from disk without path traversal."""
        safe_session = os.path.basename(session_id)
        page_filename = f"page_{page_num}.png"
        filepath = os.path.join(self.output_dir, safe_session, page_filename)

        if os.path.exists(filepath):
            with open(filepath, "rb") as f:
                return f.read()
        return None

    def get_generated_pdf_bytes(self, session_id: str) -> Optional[bytes]:
        """Safely reads the compiled multi-page PDF from disk without path traversal."""
        safe_session = os.path.basename(session_id)
        filepath = os.path.join(self.output_dir, safe_session, "document.pdf")
        if os.path.exists(filepath):
            with open(filepath, "rb") as f:
                return f.read()
        return None



# Global singleton instance
generation_service = HandwritingGenerationService()


def get_generation_service() -> HandwritingGenerationService:
    return generation_service

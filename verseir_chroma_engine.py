import math
import json

class TravellingWaveFilterBank:
    def __init__(self):
        self.A = 165.4
        self.a = 0.06
        self.k = 1.0
        self.length_mm = 35.0

    def frequency_to_position(self, f):
        if f <= 0: return self.length_mm
        pos = (1.0 / self.a) * math.log10((f / self.A) + self.k)
        return max(0, min(self.length_mm, pos))

class VerseIRChromaEngine:
    def __init__(self):
        self.twfb = TravellingWaveFilterBank()
        # Full 20 Vowel ARPAbet Set with Formants (F1, F2)
        self.vowels = {
            "IY": (270, 2290), "IH": (390, 1990), "EY": (530, 1840), "EH": (610, 1720),
            "AE": (860, 1550), "AA": (730, 1090), "AH": (640, 1190), "AO": (570, 840),
            "OW": (460, 1100), "UH": (440, 1020), "UW": (300, 870),  "ER": (490, 1350),
            "AX": (500, 1500), "AY": (660, 1720), "AW": (760, 1320), "OY": (500, 1000),
            "UR": (450, 1200), "OH": (550, 950),  "OO": (400, 900),  "YUW": (350, 1800)
        }
        
        # 8 Functional School Skins (Base Saturation/Lightness/HueBias)
        self.skins = {
            "SONIC":      {"h_bias": 174, "s": 55, "l_range": (35, 75)}, # Teal - Vibrant
            "PSYCHIC":    {"h_bias": 200, "s": 65, "l_range": (40, 80)}, # Sapphire - Piercing
            "VOID":       {"h_bias": 171, "s": 15, "l_range": (20, 60)}, # Obsidian - Muted
            "ALCHEMY":    {"h_bias": 185, "s": 50, "l_range": (45, 70)}, # Ethereal Teal - Fluctuating
            "WILL":       {"h_bias": 156, "s": 50, "l_range": (30, 65)}, # Malachite - Heavy
            "NECROMANCY": {"h_bias": 150, "s": 60, "l_range": (25, 55)}, # Emerald - Dark
            "ABJURATION": {"h_bias": 136, "s": 55, "l_range": (50, 85)}, # Aquamarine - Protective
            "DIVINATION": {"h_bias": 134, "s": 45, "l_range": (55, 80)}  # Topaz-Green - Clear
        }

    def generate_full_matrix(self):
        matrix = {}
        for school, skin in self.skins.items():
            matrix[school] = {}
            for vowel, (f1, f2) in self.vowels.items():
                # 1. Biological Hue (shifted by school bias)
                pos_f2 = self.twfb.frequency_to_position(f2)
                # Map position to a local hue range around the skin's bias
                # Variance: +/- 20 degrees based on phonetic shift
                vowel_hue_shift = ((pos_f2 / self.twfb.length_mm) * 40) - 20
                final_hue = int(skin["h_bias"] + vowel_hue_shift) % 360
                
                # 2. Perfect Lightness (interpolated within school's functional range)
                # F1 (Height) -> level 0 (high) to level 1 (low)
                # We normalize F1 from 270 (IY) to 860 (AE)
                f1_norm = (f1 - 270) / (860 - 270)
                l_min, l_max = skin["l_range"]
                final_lightness = int(l_max - (f1_norm * (l_max - l_min)))
                
                # 3. Saturation (fixed per school, with slight "Vowel Purity" bump)
                purity_bump = 10 if vowel in ["IY", "AA", "UW"] else 0
                final_saturation = min(100, skin["s"] + purity_bump)
                
                # 4. Generate Bytecode (Signature of this specific resonance)
                bytecode = f"{f1:03x}{f2:04x}{final_hue:03x}"
                
                matrix[school][vowel] = {
                    "hex": f"hsl({final_hue}, {final_saturation}%, {final_lightness}%)",
                    "bytecode": f"0x{bytecode}",
                    "hue": final_hue,
                    "mass": 100 - final_lightness
                }
        return matrix

def main():
    engine = VerseIRChromaEngine()
    matrix = engine.generate_full_matrix()
    
    # Output 1: Human-readable Manifest
    output_file = "verseir_20vowel_matrix.txt"
    with open(output_file, "w") as f:
        f.write("VERSE IR — 20-VOWEL INTERCHANGE MATRIX\n")
        f.write("ALGORITHM: BIOLOGICAL RESONANCE + SCHOOL SKINNING\n")
        f.write("=" * 60 + "\n\n")
        
        for school, vowels in matrix.items():
            f.write(f"SCHOOL: [{school}]\n")
            f.write("-" * 30 + "\n")
            # Sort by mass (heaviest to lightest)
            sorted_vowels = sorted(vowels.items(), key=lambda x: x[1]['mass'], reverse=True)
            for vowel, data in sorted_vowels:
                f.write(f"  {vowel:3} | {data['hex']:20} | BC: {data['bytecode']} | MASS: {data['mass']}%\n")
            f.write("\n")
            
    # Output 2: JSON Payload for JS integration
    with open("verseir_palette_payload.json", "w") as f:
        json.dump(matrix, f, indent=2)
            
    print(f"Algorithm executed. Full matrix saved to {output_file}")
    print(f"JSON Payload generated for CODEx integration.")

if __name__ == "__main__":
    main()

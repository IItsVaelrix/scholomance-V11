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
        
        # 8 Functional School Skins (7 Distinct Hues + 1 Neutral)
        self.skins = {
            "WILL":       {"h_bias": 0,   "s": 85, "l_range": (30, 65)}, # Red
            "DIVINATION": {"h_bias": 45,  "s": 90, "l_range": (55, 80)}, # Gold
            "NECROMANCY": {"h_bias": 120, "s": 75, "l_range": (25, 55)}, # Green
            "ABJURATION": {"h_bias": 180, "s": 80, "l_range": (50, 85)}, # Cyan
            "PSYCHIC":    {"h_bias": 220, "s": 90, "l_range": (40, 80)}, # Blue
            "SONIC":      {"h_bias": 275, "s": 85, "l_range": (35, 75)}, # Purple
            "ALCHEMY":    {"h_bias": 325, "s": 80, "l_range": (45, 70)}, # Pink
            "VOID":       {"h_bias": 215, "s": 15, "l_range": (20, 60)}, # Slate
        }

    def generate_full_matrix(self):
        matrix = {}
        for school, skin in self.skins.items():
            matrix[school] = {}
            for vowel, (f1, f2) in self.vowels.items():
                # 1. Biological Place (F2 Position)
                pos_f2 = self.twfb.frequency_to_position(f2)
                pos_f1 = self.twfb.frequency_to_position(f1)
                
                centroid_norm = pos_f2 / self.twfb.length_mm
                
                # Derive additional biophysical metrics
                # Spread: distance between F1 and F2
                spread_norm = abs(pos_f2 - pos_f1) / self.twfb.length_mm
                
                # Skew: ratio of F1 to F2
                skew_norm = (f1 / f2) * 2.0 - 1.0 # Centered around 0
                
                # Sharpness: vowel purity/distinctiveness
                sharpness_norm = 0.8 if vowel in ["IY", "AA", "UW"] else 0.4
                
                # Distinctiveness: how far it is from the center (Schwa)
                distinct_norm = abs(f2 - 1500) / 1500.0
                
                # Biological Hue
                vowel_hue_shift = (centroid_norm * 50) - 25
                final_hue = int(skin["h_bias"] + vowel_hue_shift) % 360
                
                f1_norm = (f1 - 270) / (860 - 270)
                l_min, l_max = skin["l_range"]
                final_lightness = int(l_max - (f1_norm * (l_max - l_min)))
                
                purity_bump = 10 if vowel in ["IY", "AA", "UW"] else 0
                final_saturation = min(100, skin["s"] + purity_bump)
                
                bytecode = f"{f1:03x}{f2:04x}{final_hue:03x}"
                
                matrix[school][vowel] = {
                    "hex": f"hsl({final_hue}, {final_saturation}%, {final_lightness}%)",
                    "bytecode": f"0x{bytecode}",
                    "hue": final_hue,
                    "mass": 100 - final_lightness,
                    "metrics": {
                        "centroidNorm": round(centroid_norm, 4),
                        "spreadNorm": round(spread_norm, 4),
                        "skewNorm": round(skew_norm, 4),
                        "sharpnessNorm": round(sharpness_norm, 4),
                        "distinctNorm": round(distinct_norm, 4)
                    }
                }
        return matrix

def main():
    engine = VerseIRChromaEngine()
    matrix = engine.generate_full_matrix()
    
    with open("verseir_20vowel_matrix.txt", "w") as f:
        f.write("VERSE IR — 20-VOWEL INTERCHANGE MATRIX (Biophysical Metrics)\n")
        f.write("=" * 60 + "\n\n")
        for school, vowels in matrix.items():
            f.write(f"SCHOOL: [{school}]\n")
            sorted_vowels = sorted(vowels.items(), key=lambda x: x[1]['mass'], reverse=True)
            for vowel, data in sorted_vowels:
                m = data['metrics']
                f.write(f"  {vowel:3} | {data['hex']:20} | CN: {m['centroidNorm']:.2f} SP: {m['spreadNorm']:.2f} SK: {m['skewNorm']:.2f}\n")
            f.write("\n")
            
    with open("verseir_palette_payload.json", "w") as f:
        json.dump(matrix, f, indent=2)
            
    print(f"Algorithm executed. Full matrix with biophysical metrics saved.")

if __name__ == "__main__":
    main()
